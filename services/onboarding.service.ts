import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache/tags";
import type { SessionUser } from "@/types/auth";
import type {
  OnboardingProgress,
  OnboardingStep,
  OnboardingStepId,
} from "@/features/onboarding/types/onboarding.types";
import { onboardingMock } from "@/features/onboarding/mocks/onboarding.mock";

const DEFAULT_STEPS: Array<{
  stepKey: OnboardingStepId;
  title: string;
  description: string;
  sortOrder: number;
}> = [
  {
    stepKey: "create-ad-account",
    title: "Crea tu cuenta publicitaria",
    description: "Configura tu primera cuenta para empezar a publicar.",
    sortOrder: 1,
  },
  {
    stepKey: "add-wallet-balance",
    title: "Agrega saldo a tu Cartera Default",
    description: "Recarga fondos mediante tu pasarela preferida.",
    sortOrder: 2,
  },
  {
    stepKey: "allocate-balance",
    title: "Asigna saldo a la cuenta publicitaria",
    description: "Distribuye presupuesto entre tus cuentas activas.",
    sortOrder: 3,
  },
];

const getCachedOnboardingSteps = (organizationId: string) =>
  unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("organization_onboarding_steps")
        .select("step_key, title, completed_at, sort_order")
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true });

      if (error) return null;
      return data;
    },
    [`onboarding-steps-${organizationId}`],
    {
      revalidate: 60,
      tags: [CACHE_TAGS.onboarding(organizationId)],
    },
  )();

export const getOnboardingStatus = cache(async (
  session: SessionUser,
): Promise<OnboardingProgress> => {
  if (!session.organizationId) {
    return { ...onboardingMock, completedSteps: 0 };
  }

  const data = await getCachedOnboardingSteps(session.organizationId);

  if (!data || data.length === 0) {
    return inferOnboardingFromData(session);
  }

  const steps: OnboardingStep[] = data.map((row) => ({
    id: row.step_key as OnboardingStepId,
    label: row.title,
    completed: row.completed_at !== null,
  }));

  const completedSteps = steps.filter((step) => step.completed).length;
  return {
    steps,
    totalSteps: steps.length,
    completedSteps,
  };
});

export async function completeOnboardingStep(
  session: SessionUser,
  stepKey: OnboardingStepId,
): Promise<OnboardingProgress> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const supabase = await createClient();
  const template = DEFAULT_STEPS.find((step) => step.stepKey === stepKey);
  if (!template) {
    throw new Error("Paso de onboarding inválido.");
  }

  const { error } = await supabase.from("organization_onboarding_steps").upsert(
    {
      organization_id: session.organizationId,
      step_key: stepKey,
      title: template.title,
      description: template.description,
      sort_order: template.sortOrder,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,step_key" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidateTag(CACHE_TAGS.onboarding(session.organizationId), "max");
  return getOnboardingStatus(session);
}

async function inferOnboardingFromData(
  session: SessionUser,
): Promise<OnboardingProgress> {
  const supabase = await createClient();
  const organizationId = session.organizationId!;

  const [accountsRes, walletRes, balancesRes] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("v_wallet_ledger_balances")
      .select("available_balance_cents")
      .eq("organization_id", organizationId)
      .maybeSingle<{ available_balance_cents: number }>(),
    supabase
      .from("v_ad_account_ledger_balances")
      .select("available_balance_cents")
      .eq("organization_id", organizationId),
  ]);

  const hasAdAccount = (accountsRes.count ?? 0) > 0;
  const hasDeposit = Number(walletRes.data?.available_balance_cents ?? 0) > 0;
  const hasAllocation = (balancesRes.data ?? []).some(
    (row) => Number(row.available_balance_cents ?? 0) > 0,
  );

  const steps: OnboardingStep[] = [
    {
      id: "create-ad-account",
      label: DEFAULT_STEPS[0]!.title,
      completed: hasAdAccount,
    },
    {
      id: "add-wallet-balance",
      label: DEFAULT_STEPS[1]!.title,
      completed: hasDeposit,
    },
    {
      id: "allocate-balance",
      label: DEFAULT_STEPS[2]!.title,
      completed: hasAllocation,
    },
  ];

  const completedSteps = steps.filter((step) => step.completed).length;
  return { steps, totalSteps: steps.length, completedSteps };
}
