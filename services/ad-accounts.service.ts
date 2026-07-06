import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAdAccountLedgerAccounts } from "@/lib/ledger/ledger.server";
import { centsToAmount } from "@/lib/services/mappers";
import type { SessionUser } from "@/types/auth";
import type {
  DbAdAccountRow,
  DbAdAccountBalanceRow,
  DbAdAccountsPageSummaryRow,
  DbAdPlatform,
} from "@/types/database";
import type { AdAccount, AdAccountsOverview } from "@/types/ad-account";

async function getBalanceByAdAccount(organizationId: string): Promise<Map<string, number>> {
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

  const { data: balanceRows } = await supabase
    .from("ad_account_balances")
    .select("ad_account_id, organization_id, balance_cents, currency")
    .eq("organization_id", organizationId);

  return new Map(
    ((balanceRows ?? []) as DbAdAccountBalanceRow[]).map((row) => [
      row.ad_account_id,
      row.balance_cents,
    ]),
  );
}

export async function getAdAccountsOverview(
  session: SessionUser,
): Promise<AdAccountsOverview> {
  const organizationId = session.organizationId;
  if (!organizationId) {
    return emptyOverview();
  }

  const supabase = await createClient();
  const [accountsRes, balanceByAccount, summaryRes] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    getBalanceByAdAccount(organizationId),
    supabase
      .from("v_ad_accounts_page_summary")
      .select("organization_id, total_accounts, active_accounts, pending_setup, assigned_balance_cents")
      .eq("organization_id", organizationId)
      .maybeSingle<DbAdAccountsPageSummaryRow>(),
  ]);

  const accountRows = (accountsRes.data ?? []) as DbAdAccountRow[];
  const accounts = accountRows.map((row) => mapAdAccountRow(row, balanceByAccount));

  const assignedBalanceCents = Array.from(balanceByAccount.values()).reduce(
    (sum, value) => sum + value,
    0,
  );

  const pageSummary = summaryRes.data;
  const summary = {
    totalAccounts: pageSummary?.total_accounts ?? accounts.length,
    activeAccounts: pageSummary?.active_accounts ?? accounts.filter((a) => a.status === "active").length,
    assignedBalance: centsToAmount(assignedBalanceCents || pageSummary?.assigned_balance_cents || 0),
    pendingSetup: pageSummary?.pending_setup ?? accounts.filter((a) => a.status === "pending").length,
  };

  return { summary, accounts };
}

export interface CreateAdAccountInput {
  name: string;
  platform: DbAdPlatform;
  externalAccountId?: string;
  timezone?: string;
}

export async function createAdAccount(
  session: SessionUser,
  input: CreateAdAccountInput,
): Promise<AdAccount> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("ad_accounts")
    .insert({
      organization_id: session.organizationId,
      name: input.name.trim(),
      platform: input.platform,
      external_account_id: input.externalAccountId?.trim() || null,
      status: "pending",
      created_by: session.id,
      timezone: input.timezone || "America/Lima",
    })
    .select("id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at")
    .single<DbAdAccountRow>();

  if (error || !account) {
    throw new Error(error?.message ?? "No se pudo crear la cuenta publicitaria.");
  }

  try {
    await ensureAdAccountLedgerAccounts(account.id);
  } catch (ledgerError) {
    // Fallback para instalaciones sin migración 006. En producción debe existir el ledger.
    const { error: balanceError } = await admin.from("ad_account_balances").upsert(
      {
        ad_account_id: account.id,
        organization_id: session.organizationId,
        balance_cents: 0,
        currency: account.currency,
      },
      { onConflict: "ad_account_id" },
    );
    if (balanceError) {
      throw new Error(
        ledgerError instanceof Error ? ledgerError.message : balanceError.message,
      );
    }
  }

  await admin.from("audit_logs").insert({
    organization_id: session.organizationId,
    actor_user_id: session.id,
    action: "ad_account.created",
    entity_type: "ad_account",
    entity_id: account.id,
    metadata: { platform: input.platform, external_account_id: input.externalAccountId ?? null },
  });

  return mapAdAccountRow(account, new Map([[account.id, 0]]));
}

function mapAdAccountRow(
  row: DbAdAccountRow,
  balanceByAccount: Map<string, number>,
): AdAccount {
  return {
    id: row.id,
    name: row.name,
    bcId: row.external_account_id ?? "—",
    status: row.status,
    cost: centsToAmount(row.daily_budget_cents),
    balance: centsToAmount(balanceByAccount.get(row.id) ?? 0),
    autoRecharge: false,
    thresholdInfo: "Sin umbral configurado",
    timezone: "UTC",
  };
}

function emptyOverview(): AdAccountsOverview {
  return {
    summary: {
      totalAccounts: 0,
      activeAccounts: 0,
      assignedBalance: 0,
      pendingSetup: 0,
    },
    accounts: [],
  };
}
