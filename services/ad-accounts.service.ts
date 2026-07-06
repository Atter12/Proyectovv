import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAdAccountLedgerAccounts } from "@/lib/ledger/ledger.server";
import { centsToAmount } from "@/lib/services/mappers";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { isRecord } from "@/lib/records";
import type { SessionUser } from "@/types/auth";
import type {
  DbAdAccountRow,
  DbAdAccountBalanceRow,
  DbAdAccountsPageSummaryRow,
  DbAdPlatform,
  DbAdAccountStatus,
} from "@/types/database";
import type { AdAccount, AdAccountsOverview, AdAccountStatus } from "@/types/ad-account";

const AD_ACCOUNT_SELECT =
  "id, organization_id, name, platform, external_account_id, external_business_id, external_account_name, status, daily_budget_cents, monthly_limit_cents, auto_recharge_enabled, recharge_threshold_cents, timezone, currency, metadata, created_at, updated_at";

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
  options: { includeArchived?: boolean } = {},
): Promise<AdAccountsOverview> {
  const organizationId = session.organizationId;
  if (!organizationId) {
    return emptyOverview();
  }

  const supabase = await createClient();
  const [accountsRes, balanceByAccount, summaryRes] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select(AD_ACCOUNT_SELECT)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    getBalanceByAdAccount(organizationId),
    supabase
      .from("v_ad_accounts_page_summary")
      .select("organization_id, total_accounts, active_accounts, pending_setup, assigned_balance_cents")
      .eq("organization_id", organizationId)
      .maybeSingle<DbAdAccountsPageSummaryRow>(),
  ]);

  const accountRows = ((accountsRes.data ?? []) as DbAdAccountRow[]).filter(
    (row) => options.includeArchived || !isArchivedRow(row),
  );
  const accounts = accountRows.map((row) => mapAdAccountRow(row, balanceByAccount));

  const assignedBalanceCents = accounts.reduce(
    (sum, account) => sum + Math.round(account.balance * 100),
    0,
  );

  const pageSummary = summaryRes.data;
  const summary = {
    totalAccounts: options.includeArchived
      ? pageSummary?.total_accounts ?? accounts.length
      : accounts.length,
    activeAccounts: accounts.filter((a) => a.status === "active").length,
    assignedBalance: centsToAmount(assignedBalanceCents || pageSummary?.assigned_balance_cents || 0),
    pendingSetup: accounts.filter((a) => a.status === "pending").length,
  };

  return { summary, accounts };
}

export interface CreateAdAccountInput {
  name: string;
  platform: DbAdPlatform;
  externalAccountId?: string;
  externalBusinessId?: string;
  externalAccountName?: string;
  timezone?: string;
  dailyBudget?: number;
  monthlyLimit?: number;
  autoRechargeEnabled?: boolean;
  rechargeThreshold?: number;
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
      external_business_id: input.externalBusinessId?.trim() || null,
      external_account_name: input.externalAccountName?.trim() || null,
      daily_budget_cents: amountToCents(input.dailyBudget),
      monthly_limit_cents: amountToCents(input.monthlyLimit),
      auto_recharge_enabled: Boolean(input.autoRechargeEnabled),
      recharge_threshold_cents: amountToCents(input.rechargeThreshold),
      status: "pending",
      created_by: session.id,
      timezone: input.timezone || "America/Lima",
      metadata: {
        source: "dashboard",
        connection_type: input.externalAccountId ? "manual_external" : "manual_demo",
      },
    })
    .select(AD_ACCOUNT_SELECT)
    .single<DbAdAccountRow>();

  if (error || !account) {
    throw new Error(error?.message ?? "No se pudo crear la cuenta publicitaria.");
  }

  try {
    await ensureAdAccountLedgerAccounts(account.id);
  } catch (ledgerError) {
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

  await createNotificationBestEffort({
    organizationId: session.organizationId,
    userId: session.id,
    title: "Cuenta publicitaria creada",
    body: account.name,
    type: "ad_account_created",
    data: { ad_account_id: account.id, url: "/ad-accounts" },
  });

  return mapAdAccountRow(account, new Map([[account.id, 0]]));
}

export interface UpdateAdAccountInput {
  name?: string;
  platform?: DbAdPlatform;
  externalAccountId?: string | null;
  externalBusinessId?: string | null;
  externalAccountName?: string | null;
  timezone?: string;
  dailyBudget?: number;
  monthlyLimit?: number;
  autoRechargeEnabled?: boolean;
  rechargeThreshold?: number;
  status?: Exclude<AdAccountStatus, "archived">;
}

export async function updateAdAccount(
  session: SessionUser,
  accountId: string,
  input: UpdateAdAccountInput,
): Promise<AdAccount> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const existing = await getAdAccountForMutation(session.organizationId, accountId);
  if (!existing) {
    throw new Error("Cuenta publicitaria no encontrada.");
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.platform !== undefined) patch.platform = input.platform;
  if (input.externalAccountId !== undefined) {
    patch.external_account_id = input.externalAccountId?.trim() || null;
  }
  if (input.externalBusinessId !== undefined) {
    patch.external_business_id = input.externalBusinessId?.trim() || null;
  }
  if (input.externalAccountName !== undefined) {
    patch.external_account_name = input.externalAccountName?.trim() || null;
  }
  if (input.timezone !== undefined) patch.timezone = input.timezone.trim() || "America/Lima";
  if (input.dailyBudget !== undefined) patch.daily_budget_cents = amountToCents(input.dailyBudget);
  if (input.monthlyLimit !== undefined) patch.monthly_limit_cents = amountToCents(input.monthlyLimit);
  if (input.autoRechargeEnabled !== undefined) {
    patch.auto_recharge_enabled = Boolean(input.autoRechargeEnabled);
  }
  if (input.rechargeThreshold !== undefined) {
    patch.recharge_threshold_cents = amountToCents(input.rechargeThreshold);
  }
  if (input.status !== undefined) patch.status = input.status;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ad_accounts")
    .update(patch)
    .eq("id", accountId)
    .eq("organization_id", session.organizationId)
    .select(AD_ACCOUNT_SELECT)
    .single<DbAdAccountRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar la cuenta.");
  }

  await admin.from("audit_logs").insert({
    organization_id: session.organizationId,
    actor_user_id: session.id,
    action: "ad_account.updated",
    entity_type: "ad_account",
    entity_id: accountId,
    metadata: { fields: Object.keys(patch) },
  });

  return mapAdAccountRow(data, await getBalanceByAdAccount(session.organizationId));
}

export async function archiveAdAccount(
  session: SessionUser,
  accountId: string,
): Promise<void> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const existing = await getAdAccountForMutation(session.organizationId, accountId);
  if (!existing) throw new Error("Cuenta publicitaria no encontrada.");

  const admin = createAdminClient();
  const metadata = {
    ...(isRecord(existing.metadata) ? existing.metadata : {}),
    archived_at: new Date().toISOString(),
    archived_by: session.id,
  };

  const { error } = await admin
    .from("ad_accounts")
    .update({ status: "disabled", metadata, updated_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("organization_id", session.organizationId);

  if (error) throw new Error(error.message);

  await admin.from("audit_logs").insert({
    organization_id: session.organizationId,
    actor_user_id: session.id,
    action: "ad_account.archived",
    entity_type: "ad_account",
    entity_id: accountId,
    metadata: { previous_status: existing.status },
  });
}

export async function setAdAccountStatus(
  session: SessionUser,
  accountId: string,
  status: DbAdAccountStatus,
): Promise<void> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const existing = await getAdAccountForMutation(session.organizationId, accountId);
  if (!existing) throw new Error("Cuenta publicitaria no encontrada.");

  const metadata = isArchivedRow(existing)
    ? {
        ...(isRecord(existing.metadata) ? existing.metadata : {}),
        archived_at: null,
        restored_at: new Date().toISOString(),
        restored_by: session.id,
      }
    : existing.metadata ?? {};

  const admin = createAdminClient();
  const { error } = await admin
    .from("ad_accounts")
    .update({ status, metadata, updated_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("organization_id", session.organizationId);

  if (error) throw new Error(error.message);

  await admin.from("audit_logs").insert({
    organization_id: session.organizationId,
    actor_user_id: session.id,
    action: `ad_account.${status}`,
    entity_type: "ad_account",
    entity_id: accountId,
    metadata: { previous_status: existing.status },
  });
}

async function getAdAccountForMutation(
  organizationId: string,
  accountId: string,
): Promise<DbAdAccountRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ad_accounts")
    .select(AD_ACCOUNT_SELECT)
    .eq("id", accountId)
    .eq("organization_id", organizationId)
    .maybeSingle<DbAdAccountRow>();
  return data ?? null;
}

function amountToCents(amount: number | undefined): number {
  if (amount === undefined || !Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount * 100));
}

function isArchivedRow(row: Pick<DbAdAccountRow, "metadata">): boolean {
  return isRecord(row.metadata) && Boolean(row.metadata.archived_at);
}

function mapAdAccountRow(
  row: DbAdAccountRow,
  balanceByAccount: Map<string, number>,
): AdAccount {
  const isArchived = isArchivedRow(row);
  const status: AdAccountStatus = isArchived ? "archived" : row.status;
  const dailyBudget = centsToAmount(row.daily_budget_cents ?? 0);
  const monthlyLimit = centsToAmount(row.monthly_limit_cents ?? 0);
  const rechargeThreshold = centsToAmount(row.recharge_threshold_cents ?? 0);
  const connectionLabel = row.external_account_id
    ? `${platformLabel(row.platform)} conectado/manual`
    : "Manual/Demo";

  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    bcId: row.external_business_id ?? row.external_account_id ?? "—",
    externalAccountId: row.external_account_id ?? null,
    externalBusinessId: row.external_business_id ?? null,
    externalAccountName: row.external_account_name ?? null,
    status,
    cost: dailyBudget,
    dailyBudget,
    monthlyLimit,
    balance: centsToAmount(balanceByAccount.get(row.id) ?? 0),
    autoRecharge: Boolean(row.auto_recharge_enabled),
    rechargeThreshold,
    thresholdInfo: rechargeThreshold > 0 ? `${rechargeThreshold} ${row.currency}` : "Sin umbral configurado",
    timezone: row.timezone ?? "America/Lima",
    connectionLabel,
    isArchived,
  };
}

function platformLabel(platform: DbAdPlatform): string {
  switch (platform) {
    case "meta":
      return "Meta";
    case "google":
      return "Google";
    case "tiktok":
      return "TikTok";
    case "linkedin":
      return "LinkedIn";
    default:
      return "Otra plataforma";
  }
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
