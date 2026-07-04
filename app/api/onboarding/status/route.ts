import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { getOnboardingStatus } from "@/services/onboarding.service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const status = await getOnboardingStatus(session);
  return NextResponse.json({ ok: true, ...status });
}
