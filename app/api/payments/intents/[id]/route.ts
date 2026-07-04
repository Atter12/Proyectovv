import { NextResponse } from "next/server";
import { getPaymentIntentById } from "@/lib/payments/payment-intents.server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!hasPermission(session.permissions, "payments:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  const intent = await getPaymentIntentById(id, session.organizationId);
  if (!intent) {
    return NextResponse.json({ error: "Intención no encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    paymentIntent: {
      id: intent.id,
      status: intent.status,
      amountCents: intent.amountCents,
      currency: intent.currency,
      provider: intent.provider,
      checkoutUrl: intent.checkoutUrl,
    },
  });
}
