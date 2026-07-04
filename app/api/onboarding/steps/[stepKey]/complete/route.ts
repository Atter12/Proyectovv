import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { completeOnboardingStep } from "@/services/onboarding.service";
import type { OnboardingStepId } from "@/features/onboarding/types/onboarding.types";

interface RouteContext {
  params: Promise<{ stepKey: string }>;
}

const VALID_STEP_KEYS: OnboardingStepId[] = [
  "create-ad-account",
  "add-wallet-balance",
  "allocate-balance",
];

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { stepKey } = await context.params;
  if (!VALID_STEP_KEYS.includes(stepKey as OnboardingStepId)) {
    return NextResponse.json({ error: "Paso inválido." }, { status: 400 });
  }

  try {
    const status = await completeOnboardingStep(
      session,
      stepKey as OnboardingStepId,
    );
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo completar el paso.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
