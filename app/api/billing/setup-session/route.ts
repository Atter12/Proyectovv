import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { startBillingSetupSession } from "@/lib/payments/auto-recharge/auto-recharge.server";

export async function POST() {
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
  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  try {
    const result = await startBillingSetupSession({
      organizationId: session.organizationId,
      userId: session.id,
      email: session.email,
    });
    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo iniciar guardado de tarjeta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
