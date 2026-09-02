import { cache } from "react";
import { siteConfig } from "@/config/site";
import {
  getCachedDefaultGatewayId,
  getCachedPaymentGateways,
} from "@/lib/cache/gateways.server";
import { createClient } from "@/lib/supabase/server";
import { centsToAmount, mapWalletTransactionRow } from "@/lib/services/mappers";
import { getString, isRecord } from "@/lib/records";
import { listFinancialActivity } from "@/lib/ledger/ledger.server";
import type { SessionUser } from "@/types/auth";
import type {
  DbAdAccountRow,
  DbAdAccountBalanceRow,
  DbPaymentIntentRow,
  DbPaymentsPageSummaryRow,
  DbWalletTransactionRow,
} from "@/types/database";
import type {
  PaymentAccountAllocation,
  PaymentPageCore,
  PaymentTabKey,
  TransactionHistoryItem,
} from "@/types/payment";
import {
  isStaffBlockedAdAccount,
  mergeStaffBlockMetadata,
  staffBlockStatusForUpsert,
} from "@/lib/payments/staff-block.server";

const TRANSACTION_PAGE_SIZE = 25;

const TX_TYPE_BY_TAB: Record<
  Exclude<PaymentTabKey, "assignment">,
  DbWalletTransactionRow["type"] | DbWalletTransactionRow["type"][]
> = {
  "account-tx": "allocation",
  "wallet-tx": ["deposit", "withdrawal", "adjustment"],
  refunds: "refund",
};

const LEDGER_TYPES_BY_TAB: Record<Exclude<PaymentTabKey, "assignment">, string[]> = {
  "account-tx": [
    "allocation_to_ad_account",
    "ad_account_budget_reserved",
    "ad_account_budget_released",
  ],
  "wallet-tx": ["deposit_confirmed", "legacy_wallet_available_opening"],
  refunds: ["ad_account_refund_to_wallet", "journal_reversal"],
};

async function getAdAccountBalanceMap(organizationId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data: ledgerRows, error: ledgerError } = await supabase
    .from("v_ad_account_ledger_balances")
    .select("ad_account_id, available_balance_cents")
    .eq("organization_id", organizationId);

  if (!ledgerError && ledgerRows) {
    return new Map(
      ledgerRows.map((row) => [
        row.ad_account_id,
        Number(row.available_balance_cents ?? 0),
      ]),
    );
  }

  const { data: legacyRows } = await supabase
    .from("ad_account_balances")
    .select("ad_account_id, organization_id, balance_cents, currency")
    .eq("organization_id", organizationId);

  return new Map(
    ((legacyRows ?? []) as DbAdAccountBalanceRow[]).map((row) => [
      row.ad_account_id,
      row.balance_cents,
    ]),
  );
}

/**
 * Lista ad_accounts de la org con service role (sin RLS de anon).
 * Importante: gerentes y super admin ven el mismo set para Asignar/Fondear.
 */
export async function listOrganizationAdAccountsForAllocation(
  organizationId: string,
): Promise<PaymentAccountAllocation[]> {
  if (!organizationId) return [];

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const [accountsRes, balanceByAccount] = await Promise.all([
      admin
        .from("ad_accounts")
        .select(
          "id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at, metadata",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      getAdAccountBalanceMapAdmin(organizationId),
    ]);

    if (accountsRes.error) {
      console.warn("[payments] list_org_ad_accounts", accountsRes.error.message);
      return [];
    }

    const accountRows = (accountsRes.data ?? []) as DbAdAccountRow[];
    return accountRows.map((account) => {
      const metadata = (account as { metadata?: unknown }).metadata;
      const blocked = isStaffBlockedAdAccount({
        status: account.status,
        metadata,
        externalAccountId: account.external_account_id,
        hecomClienteId: isRecord(metadata)
          ? String(metadata.hecom_cliente_id ?? "")
          : null,
      });
      return {
        id: account.id,
        name: account.name,
        status: blocked ? "disabled" : account.status,
        balance: centsToAmount(balanceByAccount.get(account.id) ?? 0),
        autoRecharge: false,
        thresholdInfo: "Sin auto-recarga configurada",
        externalAccountId: account.external_account_id ?? null,
      };
    });
  } catch (error) {
    console.error("[payments] list_org_ad_accounts_fatal", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

/**
 * Garantiza filas ad_accounts en la org del usuario (gerente vs super admin
 * tienen organizations distintas: sin esto el SA ve Asignar y el gerente no).
 * Copia metadata de otras orgs si el advertiser ya existía ahí.
 */
export async function ensureAdvertisersInOrganizationForAllocation(input: {
  organizationId: string;
  clienteId: string;
  clienteName?: string;
  userId?: string | null;
  advertisers: Array<{
    advertiserId: string;
    name?: string | null;
    status?: string | null;
  }>;
}): Promise<number> {
  const orgId = input.organizationId?.trim();
  if (!orgId || input.advertisers.length === 0) return 0;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { ensureAdAccountLedgerAccounts } = await import(
      "@/lib/ledger/ledger.server"
    );
    const admin = createAdminClient();
    const ids = [
      ...new Set(
        input.advertisers
          .map((row) => row.advertiserId.trim())
          .filter(Boolean),
      ),
    ];
    if (ids.length === 0) return 0;

    const nameById = new Map(
      input.advertisers.map((row) => [
        row.advertiserId.trim(),
        row.name?.trim() || null,
      ]),
    );
    const statusById = new Map(
      input.advertisers.map((row) => [
        row.advertiserId.trim(),
        row.status?.trim() || null,
      ]),
    );

    const { data: globalRows } = await admin
      .from("ad_accounts")
      .select(
        "organization_id, name, external_account_id, external_business_id, external_account_name, currency, timezone, status, metadata",
      )
      .eq("platform", "tiktok")
      .in("external_account_id", ids);

    const existingInOrgRes = await admin
      .from("ad_accounts")
      .select("external_account_id, status, metadata")
      .eq("organization_id", orgId)
      .eq("platform", "tiktok")
      .in("external_account_id", ids);
    const existingInOrgById = new Map(
      (existingInOrgRes.data ?? []).map((row) => {
        const ext = String(
          (row as { external_account_id?: string }).external_account_id ?? "",
        ).trim();
        return [
          ext,
          {
            status: String((row as { status?: string }).status ?? ""),
            metadata: (row as { metadata?: unknown }).metadata ?? null,
          },
        ] as const;
      }),
    );

    const templateById = new Map<
      string,
      {
        name: string;
        external_business_id: string | null;
        external_account_name: string | null;
        currency: string;
        timezone: string;
        status: string;
        metadata: unknown;
      }
    >();
    for (const row of globalRows ?? []) {
      const ext = String(
        (row as { external_account_id?: string }).external_account_id ?? "",
      ).trim();
      if (!ext || templateById.has(ext)) continue;
      templateById.set(ext, {
        name: String((row as { name?: string }).name ?? "").trim() || ext,
        external_business_id:
          (row as { external_business_id?: string | null }).external_business_id ??
          null,
        external_account_name:
          (row as { external_account_name?: string | null })
            .external_account_name ?? null,
        currency:
          String((row as { currency?: string }).currency ?? "USD") || "USD",
        timezone:
          String((row as { timezone?: string }).timezone ?? "America/Lima") ||
          "America/Lima",
        status: String((row as { status?: string }).status ?? "active"),
        metadata: (row as { metadata?: unknown }).metadata ?? null,
      });
    }

    let upserted = 0;
    for (const advertiserId of ids) {
      const template = templateById.get(advertiserId);
      const preferredStatus = statusById.get(advertiserId);
      const existingInOrg = existingInOrgById.get(advertiserId);
      const displayName =
        nameById.get(advertiserId) ||
        template?.name ||
        (input.clienteName
          ? `${input.clienteName} · TikTok`
          : `TikTok ${advertiserId}`);

      const block = staffBlockStatusForUpsert({
        existingMetadata: existingInOrg?.metadata ?? template?.metadata,
        externalAccountId: advertiserId,
        hecomClienteId: input.clienteId,
        tiktokStatusKind:
          preferredStatus === "disabled" || template?.status === "disabled"
            ? "suspended"
            : "approved",
      });
      const status = block.blocked
        ? "disabled"
        : preferredStatus === "disabled" || template?.status === "disabled"
          ? "disabled"
          : "active";
      const metadata = block.blocked
        ? mergeStaffBlockMetadata(
            existingInOrg?.metadata ?? template?.metadata ?? null,
            { reason: "emergency_staff_block" },
          )
        : {
            ...(isRecord(existingInOrg?.metadata) ? existingInOrg.metadata : {}),
            ...(isRecord(template?.metadata) ? template.metadata : {}),
            source: "ensure_allocation_org",
            hecom_cliente_id: input.clienteId,
            hecom_cliente_name: input.clienteName ?? null,
            mirrored_from_other_org: Boolean(template),
          };

      const { error } = await admin.from("ad_accounts").upsert(
        {
          organization_id: orgId,
          name: displayName,
          platform: "tiktok",
          external_account_id: advertiserId,
          external_business_id: template?.external_business_id ?? null,
          external_account_name:
            template?.external_account_name ?? displayName,
          status,
          currency: template?.currency ?? "USD",
          timezone: template?.timezone ?? "America/Lima",
          created_by: input.userId ?? null,
          last_synced_at: new Date().toISOString(),
          metadata,
        },
        { onConflict: "organization_id,platform,external_account_id" },
      );

      if (error) {
        console.warn("[payments] ensure_advertiser_upsert", {
          advertiserId,
          error: error.message,
        });
        continue;
      }

      const { data: stored } = await admin
        .from("ad_accounts")
        .select("id")
        .eq("organization_id", orgId)
        .eq("platform", "tiktok")
        .eq("external_account_id", advertiserId)
        .maybeSingle<{ id: string }>();

      if (stored?.id) {
        await ensureAdAccountLedgerAccounts(stored.id).catch(() => undefined);
      }
      upserted += 1;
    }

    console.info("[payments] ensure_advertisers_in_org", {
      orgId,
      clienteId: input.clienteId,
      requested: ids.length,
      upserted,
      mirroredTemplates: templateById.size,
    });
    return upserted;
  } catch (error) {
    console.error("[payments] ensure_advertisers_fatal", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return 0;
  }
}

async function getAdAccountBalanceMapAdmin(
  organizationId: string,
): Promise<Map<string, number>> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: ledgerRows, error: ledgerError } = await admin
      .from("v_ad_account_ledger_balances")
      .select("ad_account_id, available_balance_cents")
      .eq("organization_id", organizationId);

    if (!ledgerError && ledgerRows) {
      return new Map(
        ledgerRows.map((row) => [
          String((row as { ad_account_id: string }).ad_account_id),
          Number(
            (row as { available_balance_cents?: number }).available_balance_cents ??
              0,
          ),
        ]),
      );
    }

    const { data: legacyRows } = await admin
      .from("ad_account_balances")
      .select("ad_account_id, balance_cents")
      .eq("organization_id", organizationId);

    return new Map(
      ((legacyRows ?? []) as Array<{ ad_account_id: string; balance_cents: number }>).map(
        (row) => [row.ad_account_id, row.balance_cents],
      ),
    );
  } catch {
    return new Map();
  }
}

async function getWalletLedgerBalance(organizationId: string): Promise<{
  walletId: string;
  currency: string;
  balanceCents: number;
  reservedBalanceCents: number;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_wallet_ledger_balances")
    .select("wallet_id, currency, available_balance_cents, reserved_balance_cents")
    .eq("organization_id", organizationId)
    .maybeSingle<{
      wallet_id: string;
      currency: string;
      available_balance_cents: number;
      reserved_balance_cents: number;
    }>();

  if (error || !data) return null;
  return {
    walletId: data.wallet_id,
    currency: data.currency,
    balanceCents: Number(data.available_balance_cents ?? 0),
    reservedBalanceCents: Number(data.reserved_balance_cents ?? 0),
  };
}

export const getPaymentPageCore = cache(async (
  session: SessionUser,
): Promise<PaymentPageCore> => {
  const organizationId = session.organizationId;
  if (!organizationId) {
    return emptyPaymentPageCore();
  }

  const supabase = await createClient();
  const [pageSummaryRes, adAccounts, balanceByAccount, gateways, preferredGateway, walletLedger] =
    await Promise.all([
      supabase
        .from("v_payments_page_summary")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle<DbPaymentsPageSummaryRow>(),
      supabase
        .from("ad_accounts")
        .select(
          "id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      getAdAccountBalanceMap(organizationId),
      getCachedPaymentGateways(),
      getCachedDefaultGatewayId(),
      getWalletLedgerBalance(organizationId),
    ]);

  let pageSummary = pageSummaryRes.data;
  if (pageSummaryRes.error || !pageSummary) {
    const { data: fallbackWallet } = await supabase
      .from("wallets")
      .select("id, organization_id, name, currency, balance_cents, reserved_balance_cents, status")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (fallbackWallet) {
      pageSummary = {
        organization_id: fallbackWallet.organization_id,
        wallet_id: fallbackWallet.id,
        name: fallbackWallet.name,
        currency: fallbackWallet.currency,
        balance_cents: fallbackWallet.balance_cents,
        status: fallbackWallet.status,
        last_deposit_at: null,
        pending_payment_intents: 0,
        pending_refunds: 0,
        accounts_ready_for_allocation: 0,
      };
    }
  }

  const accountRows = (adAccounts.data ?? []) as DbAdAccountRow[];

  const adAccountsForAllocation: PaymentAccountAllocation[] = accountRows.map(
    (account) => ({
      id: account.id,
      name: account.name,
      status: account.status,
      balance: centsToAmount(balanceByAccount.get(account.id) ?? 0),
      autoRecharge: false,
      thresholdInfo: "Sin auto-recarga configurada",
      externalAccountId: account.external_account_id ?? null,
    }),
  );

  const walletBalanceCents = walletLedger?.balanceCents ?? pageSummary?.balance_cents ?? 0;
  const walletReservedCents = walletLedger?.reservedBalanceCents ?? 0;

  return {
    wallet: {
      name: pageSummary?.name ?? siteConfig.walletName,
      balance: centsToAmount(walletBalanceCents),
      reservedBalance: centsToAmount(walletReservedCents),
      currency: walletLedger?.currency ?? pageSummary?.currency ?? "USD",
      lastTopUp: pageSummary?.last_deposit_at ?? null,
      preferredGateway,
    },
    summary: {
      pendingRefunds: pageSummary?.pending_refunds ?? 0,
      accountsReadyForAllocation: pageSummary?.accounts_ready_for_allocation ?? 0,
    },
    selectedGateway: preferredGateway,
    gateways,
    adAccountsForAllocation,
  };
});

function mapLedgerActivity(row: Awaited<ReturnType<typeof listFinancialActivity>>[number]): TransactionHistoryItem {
  return {
    id: row.id,
    date: row.createdAt,
    description: row.description ?? mapJournalTypeLabel(row.journalType),
    amount: centsToAmount(row.amountCents),
    currency: row.currency,
    status: row.status === "posted" ? "completed" : row.status,
  };
}

function mapJournalTypeLabel(journalType: string): string {
  switch (journalType) {
    case "deposit_confirmed":
      return "Depósito confirmado";
    case "allocation_to_ad_account":
      return "Asignación a cuenta publicitaria";
    case "ad_account_budget_reserved":
      return "Presupuesto reservado";
    case "ad_account_budget_released":
      return "Presupuesto liberado";
    case "ad_account_refund_to_wallet":
      return "Reembolso a cartera";
    case "journal_reversal":
      return "Reversa contable";
    default:
      return journalType.replace(/_/g, " ");
  }
}

export async function getPaymentTransactions(
  session: SessionUser,
  tab: Exclude<PaymentTabKey, "assignment">,
): Promise<TransactionHistoryItem[]> {
  const organizationId = session.organizationId;
  if (!organizationId) return [];

  const ledgerRows = await listFinancialActivity({
    organizationId,
    journalTypes: LEDGER_TYPES_BY_TAB[tab],
    limit: TRANSACTION_PAGE_SIZE,
  });

  if (ledgerRows.length > 0) {
    return ledgerRows.map(mapLedgerActivity);
  }

  const supabase = await createClient();
  const txType = TX_TYPE_BY_TAB[tab];
  let query = supabase
    .from("wallet_transactions")
    .select(
      "id, wallet_id, organization_id, type, amount_cents, currency, status, balance_after_cents, description, external_reference, idempotency_key, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(TRANSACTION_PAGE_SIZE);

  if (Array.isArray(txType)) {
    query = query.in("type", txType);
  } else {
    query = query.eq("type", txType);
  }

  const { data } = await query;
  return ((data ?? []) as DbWalletTransactionRow[]).map(mapWalletTransactionRow);
}


export interface ManualPaymentIntentItem {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  reviewStatus: "awaiting_proof" | "pending_review" | "approved" | "rejected" | "cancelled";
  proofFileName: string | null;
  failureReason: string | null;
}

function getManualIntentReviewStatus(
  row: DbPaymentIntentRow,
): ManualPaymentIntentItem["reviewStatus"] {
  if (row.status === "succeeded") return "approved";
  if (row.status === "failed") return "rejected";
  if (row.status === "cancelled") return "cancelled";
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const reviewStatus = getString(metadata.manual_review_status);
  if (reviewStatus === "pending_review") return "pending_review";
  if (row.status === "processing") return "pending_review";
  return "awaiting_proof";
}

function getManualProofFileName(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  const proof = metadata.manual_proof;
  if (!isRecord(proof)) return null;
  return getString(proof.file_name);
}

export async function getRecentManualPaymentIntents(
  session: SessionUser,
): Promise<ManualPaymentIntentItem[]> {
  const organizationId = session.organizationId;
  if (!organizationId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_intents")
    .select("id, organization_id, wallet_id, amount_cents, currency, provider, provider_reference, status, idempotency_key, checkout_url, metadata, created_by, failure_reason, created_at, updated_at")
    .eq("organization_id", organizationId)
    .in("provider", ["manual", "crypto"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return [];

  return ((data ?? []) as DbPaymentIntentRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    amount: centsToAmount(row.amount_cents),
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    reviewStatus: getManualIntentReviewStatus(row),
    proofFileName: getManualProofFileName(row.metadata),
    failureReason: row.failure_reason ?? null,
  }));
}

/** @deprecated Usar getPaymentPageCore + getPaymentTransactions */
export async function getPaymentOverview(session: SessionUser) {
  const core = await getPaymentPageCore(session);
  const [accountTransactions, walletTransactions, refunds] = await Promise.all([
    getPaymentTransactions(session, "account-tx"),
    getPaymentTransactions(session, "wallet-tx"),
    getPaymentTransactions(session, "refunds"),
  ]);

  return {
    ...core,
    accountTransactions,
    walletTransactions,
    refunds,
  };
}

function emptyPaymentPageCore(): PaymentPageCore {
  return {
    wallet: {
      name: siteConfig.walletName,
      balance: 0,
      reservedBalance: 0,
      currency: "USD",
      lastTopUp: null,
      preferredGateway: "manual",
    },
    summary: { pendingRefunds: 0, accountsReadyForAllocation: 0 },
    selectedGateway: "manual",
    gateways: [],
    adAccountsForAllocation: [],
  };
}

export type { TransactionHistoryItem };
