import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { getOnboardingStatus } from "@/services/onboarding.service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const status = await getOnboardingStatus(session);
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar el onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
