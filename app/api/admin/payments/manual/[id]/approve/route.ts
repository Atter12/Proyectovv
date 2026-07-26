import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission, hasRole } from "@/lib/auth/permissions";
import { getPaymentIntentById } from "@/lib/payments/payment-intents.server";
import { processSuccessfulPaymentIntent } from "@/lib/payments/create-intent.server";
import { isVoucherPaymentProvider } from "@/types/payment";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (
    !hasPermission(session.permissions, "payments:create") ||
    !hasRole(session.role, ["owner", "admin", "finance"])
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  const intent = await getPaymentIntentById(id, session.organizationId);
  if (!intent || !isVoucherPaymentProvider(intent.provider)) {
    return NextResponse.json({ error: "Pago con comprobante no encontrado." }, { status: 404 });
  }

  try {
    await processSuccessfulPaymentIntent({
      provider: intent.provider,
      paymentIntentId: intent.id,
      providerReference: intent.providerReference ?? `${intent.provider}:${intent.id}`,
      amountCents: intent.amountCents,
      currency: intent.currency,
      createdBy: session.id,
      webhookEventId: `${intent.provider}_approval_${intent.id}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo aprobar el pago.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
