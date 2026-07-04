import { siteConfig } from "@/config/site";
import { getOrganizationWallet } from "@/lib/auth/wallet.server";
import { createClient } from "@/lib/supabase/server";
import { centsToAmount } from "@/lib/services/mappers";
import type { SessionUser } from "@/types/auth";
import type {
  DbAdAccountRow,
  DbAdAccountBalanceRow,
  DbReferralRow,
} from "@/types/database";
import type { DashboardOverview, DashboardOnboardingStep } from "@/types/dashboard";
import type { AdAccount } from "@/types/ad-account";

const DEFAULT_ONBOARDING: Omit<DashboardOnboardingStep, "completed">[] = [
  {
    step: 1,
    title: "Crea tu cuenta publicitaria",
    description: "Configura tu primera cuenta para empezar a publicar.",
  },
  {
    step: 2,
    title: "Agrega saldo a tu Cartera Default",
    description: "Recarga fondos mediante tu pasarela preferida.",
  },
  {
    step: 3,
    title: "Asigna saldo a la cuenta publicitaria",
    description: "Distribuye presupuesto entre tus cuentas activas.",
  },
];

interface CampaignPerformanceRow {
  organization_id: string;
  spend_cents: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  revenue_cents: number | null;
}

export async function getDashboardOverview(
  session: SessionUser,
): Promise<DashboardOverview> {
  const organizationId = session.organizationId;
  const wallet =
    (await getOrganizationWallet(session)) ?? {
      id: "pending",
      name: siteConfig.walletName,
      balance: 0,
      currency: "USD",
    };

  if (!organizationId) {
    return {
      wallet,
      metrics: emptyMetrics(),
      adAccounts: [],
      onboardingSteps: DEFAULT_ONBOARDING.map((step) => ({
        ...step,
        completed: false,
      })),
    };
  }

  const supabase = await createClient();
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);
  const since30dDate = since30d.toISOString().slice(0, 10);
  const sinceToday = new Date();
  sinceToday.setHours(0, 0, 0, 0);
  const todayDate = sinceToday.toISOString().slice(0, 10);

  const [
    adAccountsRes,
    balancesRes,
    referralsRes,
    perfRes,
    campaignsRes,
    todayMetricsRes,
    onboardingRes,
  ] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select(
        "id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ad_account_balances")
      .select("ad_account_id, organization_id, balance_cents, currency")
      .eq("organization_id", organizationId),
    supabase
      .from("referrals")
      .select(
        "id, referral_code_id, referrer_user_id, referred_organization_id, status, commission_rate, commission_amount_cents, created_at, converted_at",
      )
      .eq("referrer_user_id", session.id),
    supabase
      .from("v_campaign_performance_30d")
      .select("organization_id, spend_cents, impressions, clicks, conversions, revenue_cents")
      .eq("organization_id", organizationId)
      .maybeSingle<CampaignPerformanceRow>(),
    supabase
      .from("campaigns")
      .select("id, status", { count: "exact" })
      .eq("organization_id", organizationId),
    supabase
      .from("ad_account_daily_metrics")
      .select("spend_cents")
      .eq("organization_id", organizationId)
      .eq("metric_date", todayDate),
    supabase
      .from("organization_onboarding_steps")
      .select("step_key, title, description, sort_order, completed_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true }),
  ]);

  let perf = perfRes.data;
  if (perfRes.error || !perf) {
    const { data: fallbackMetrics } = await supabase
      .from("ad_account_daily_metrics")
      .select("spend_cents, impressions, clicks, conversions, revenue_cents")
      .eq("organization_id", organizationId)
      .gte("metric_date", since30dDate);

    if (fallbackMetrics && fallbackMetrics.length > 0) {
      perf = {
        organization_id: organizationId,
        spend_cents: fallbackMetrics.reduce(
          (sum, row) => sum + Number(row.spend_cents ?? 0),
          0,
        ),
        impressions: fallbackMetrics.reduce(
          (sum, row) => sum + Number(row.impressions ?? 0),
          0,
        ),
        clicks: fallbackMetrics.reduce(
          (sum, row) => sum + Number(row.clicks ?? 0),
          0,
        ),
        conversions: fallbackMetrics.reduce(
          (sum, row) => sum + Number(row.conversions ?? 0),
          0,
        ),
        revenue_cents: fallbackMetrics.reduce(
          (sum, row) => sum + Number(row.revenue_cents ?? 0),
          0,
        ),
      };
    }
  }

  const accountRows = (adAccountsRes.data ?? []) as DbAdAccountRow[];
  const balanceRows = (balancesRes.data ?? []) as DbAdAccountBalanceRow[];
  const referralRows = (referralsRes.data ?? []) as DbReferralRow[];
  const balanceByAccount = new Map(
    balanceRows.map((row) => [row.ad_account_id, row.balance_cents]),
  );

  const adAccounts: AdAccount[] = accountRows.map((account) => ({
    id: account.id,
    name: account.name,
    bcId: account.external_account_id ?? "—",
    status: account.status,
    cost: centsToAmount(account.daily_budget_cents),
    balance: centsToAmount(balanceByAccount.get(account.id) ?? 0),
    autoRecharge: false,
    thresholdInfo: "Sin umbral configurado",
    timezone: "UTC",
  }));

  const todaySpend = (todayMetricsRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.spend_cents ?? 0),
    0,
  );

  const referralEarnings =
    referralRows.reduce(
      (sum, row) => sum + Number(row.commission_amount_cents ?? 0),
      0,
    ) / 100;

  const hasAdAccount = accountRows.length > 0;
  const hasDeposit = wallet.balance > 0;
  const hasAllocation = accountRows.some(
    (account) => (balanceByAccount.get(account.id) ?? 0) > 0,
  );

  const onboardingSteps = buildOnboardingSteps(onboardingRes.data ?? [], {
    hasAdAccount,
    hasDeposit,
    hasAllocation,
  });

  return {
    wallet,
    metrics: {
      todaySpend: centsToAmount(todaySpend),
      referralEarnings,
      referralMembers: referralRows.length,
      totalAdAccounts: accountRows.length,
      spend30d: centsToAmount(Number(perf?.spend_cents ?? 0)),
      impressions30d: Number(perf?.impressions ?? 0),
      clicks30d: Number(perf?.clicks ?? 0),
      conversions30d: Number(perf?.conversions ?? 0),
      revenue30d: centsToAmount(Number(perf?.revenue_cents ?? 0)),
      totalCampaigns: campaignsRes.count ?? 0,
    },
    adAccounts,
    onboardingSteps,
  };
}

function buildOnboardingSteps(
  dbSteps: Array<{
    step_key: string;
    title: string;
    description: string | null;
    sort_order: number;
    completed_at: string | null;
  }>,
  fallback: {
    hasAdAccount: boolean;
    hasDeposit: boolean;
    hasAllocation: boolean;
  },
): DashboardOnboardingStep[] {
  if (dbSteps.length === 0) {
    return [
      { ...DEFAULT_ONBOARDING[0]!, completed: fallback.hasAdAccount },
      { ...DEFAULT_ONBOARDING[1]!, completed: fallback.hasDeposit },
      { ...DEFAULT_ONBOARDING[2]!, completed: fallback.hasAllocation },
    ];
  }

  return dbSteps.map((step, index) => ({
    step: step.sort_order || index + 1,
    title: step.title,
    description: step.description ?? "",
    completed: step.completed_at !== null,
  }));
}

function emptyMetrics() {
  return {
    todaySpend: 0,
    referralEarnings: 0,
    referralMembers: 0,
    totalAdAccounts: 0,
    spend30d: 0,
    impressions30d: 0,
    clicks30d: 0,
    conversions30d: 0,
    revenue30d: 0,
    totalCampaigns: 0,
  };
}
