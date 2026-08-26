import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { finalizeBillingSetup } from "@/lib/payments/auto-recharge/auto-recharge.server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.organizationId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!capabilities.canClientStripeFund) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId requerido." }, { status: 400 });
  }

  try {
    await finalizeBillingSetup({
      sessionId,
      organizationId: session.organizationId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar la tarjeta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
