import { cache } from "react";
import { siteConfig } from "@/config/site";
import { getOrganizationWallet } from "@/lib/auth/wallet.server";
import { createClient } from "@/lib/supabase/server";
import { centsToAmount } from "@/lib/services/mappers";
import type { SessionUser } from "@/types/auth";
import type {
  DbAdAccountRow,
  DbAdAccountBalanceRow,
  DbOverviewPageSummaryRow,
  DbReferralRow,
} from "@/types/database";
import type { DashboardOverview, DashboardOnboardingStep } from "@/types/dashboard";
import type { AdAccount } from "@/types/ad-account";
import { getOnboardingStatus } from "@/services/onboarding.service";

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

export const getDashboardOverview = cache(async function getDashboardOverview(
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

  const [pageSummaryRes, adAccountsRes, balancesRes, referralsRes, onboardingProgress] =
    await Promise.all([
      supabase
        .from("v_overview_page_summary")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle<DbOverviewPageSummaryRow>(),
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
      getOnboardingStatus(session),
    ]);

  const pageSummary = pageSummaryRes.data;
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

  const referralEarnings =
    referralRows.reduce(
      (sum, row) => sum + Number(row.commission_amount_cents ?? 0),
      0,
    ) / 100;

  const onboardingSteps = mapOnboardingProgressToSteps(onboardingProgress, {
    hasAdAccount: accountRows.length > 0,
    hasDeposit: wallet.balance > 0,
    hasAllocation: accountRows.some(
      (account) => (balanceByAccount.get(account.id) ?? 0) > 0,
    ),
  });

  return {
    wallet: pageSummary?.wallet_id
      ? {
          id: pageSummary.wallet_id,
          name: pageSummary.wallet_name ?? siteConfig.walletName,
          balance: centsToAmount(pageSummary.wallet_balance_cents ?? 0),
          currency: pageSummary.wallet_currency ?? "USD",
        }
      : wallet,
    metrics: {
      todaySpend: centsToAmount(Number(pageSummary?.today_spend_cents ?? 0)),
      referralEarnings,
      referralMembers: referralRows.length,
      totalAdAccounts:
        pageSummary?.total_ad_accounts ?? accountRows.length,
      spend30d: centsToAmount(Number(pageSummary?.spend_30d_cents ?? 0)),
      impressions30d: Number(pageSummary?.impressions_30d ?? 0),
      clicks30d: Number(pageSummary?.clicks_30d ?? 0),
      conversions30d: Number(pageSummary?.conversions_30d ?? 0),
      revenue30d: centsToAmount(Number(pageSummary?.revenue_30d_cents ?? 0)),
      totalCampaigns: pageSummary?.total_campaigns ?? 0,
    },
    adAccounts,
    onboardingSteps,
  };
});

function mapOnboardingProgressToSteps(
  progress: Awaited<ReturnType<typeof getOnboardingStatus>>,
  fallback: {
    hasAdAccount: boolean;
    hasDeposit: boolean;
    hasAllocation: boolean;
  },
): DashboardOnboardingStep[] {
  if (progress.steps.length === 0) {
    return buildOnboardingSteps([], fallback);
  }

  return progress.steps.map((step, index) => ({
    step: index + 1,
    title: step.label,
    description: "",
    completed: step.completed,
  }));
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
