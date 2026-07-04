import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { centsToAmount } from "@/lib/services/mappers";
import type { SessionUser } from "@/types/auth";
import type {
  DbAdAccountRow,
  DbAdAccountBalanceRow,
  DbAdPlatform,
} from "@/types/database";
import type { AdAccount, AdAccountsOverview } from "@/types/ad-account";

export async function getAdAccountsOverview(
  session: SessionUser,
): Promise<AdAccountsOverview> {
  const organizationId = session.organizationId;
  if (!organizationId) {
    return emptyOverview();
  }

  const supabase = await createClient();
  const [accountsRes, balancesRes] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ad_account_balances")
      .select("ad_account_id, organization_id, balance_cents, currency")
      .eq("organization_id", organizationId),
  ]);

  const accountRows = (accountsRes.data ?? []) as DbAdAccountRow[];
  const balanceRows = (balancesRes.data ?? []) as DbAdAccountBalanceRow[];
  const balanceByAccount = new Map(
    balanceRows.map((row) => [row.ad_account_id, row.balance_cents]),
  );

  const accounts = accountRows.map((row) => mapAdAccountRow(row, balanceByAccount));

  const summary = {
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter((a) => a.status === "active").length,
    assignedBalance: accounts.reduce((sum, a) => sum + a.balance, 0),
    pendingSetup: accounts.filter((a) => a.status === "pending").length,
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

  const supabase = await createClient();
  const { data: account, error } = await supabase
    .from("ad_accounts")
    .insert({
      organization_id: session.organizationId,
      name: input.name.trim(),
      platform: input.platform,
      external_account_id: input.externalAccountId?.trim() || null,
      status: "pending",
      created_by: session.id,
    })
    .select("id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at")
    .single<DbAdAccountRow>();

  if (error || !account) {
    throw new Error(error?.message ?? "No se pudo crear la cuenta publicitaria.");
  }

  const admin = createAdminClient();
  const { error: balanceError } = await admin.from("ad_account_balances").insert({
    ad_account_id: account.id,
    organization_id: session.organizationId,
    balance_cents: 0,
    currency: account.currency,
  });

  if (balanceError) {
    throw new Error(balanceError.message);
  }

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
