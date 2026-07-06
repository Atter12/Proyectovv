import { cache } from "react";
import { siteConfig } from "@/config/site";
import {
  getCachedDefaultGatewayId,
  getCachedPaymentGateways,
} from "@/lib/cache/gateways.server";
import { createClient } from "@/lib/supabase/server";
import { centsToAmount, mapWalletTransactionRow } from "@/lib/services/mappers";
import { listFinancialActivity } from "@/lib/ledger/ledger.server";
import type { SessionUser } from "@/types/auth";
import type {
  DbAdAccountRow,
  DbAdAccountBalanceRow,
  DbPaymentsPageSummaryRow,
  DbWalletTransactionRow,
} from "@/types/database";
import type {
  PaymentAccountAllocation,
  PaymentPageCore,
  PaymentTabKey,
  TransactionHistoryItem,
} from "@/types/payment";

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
