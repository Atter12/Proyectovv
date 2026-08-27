import { NextResponse } from "next/server";
import {
  createPaymentIntentForSession,
} from "@/lib/payments/create-intent.server";
import { ProviderNotConfiguredError } from "@/lib/payments/providers";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { isPaymentGatewayId } from "@/types/payment";
import type { PaymentGatewayId } from "@/types/payment";
import { getDefaultGatewayId } from "@/lib/payments/gateway-config";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!capabilities.canClientStripeFund) {
    return NextResponse.json(
      {
        error:
          "Los gerentes recargan desde el BM. Solo el super admin o el cliente pueden usar Stripe.",
      },
      { status: 403 },
    );
  }

  let body: {
    amount?: number;
    currency?: string;
    chargeCurrency?: "USD" | "PEN";
    provider?: PaymentGatewayId;
    gatewayId?: PaymentGatewayId;
    idempotencyKey?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
  }

  const providerCandidate = body.provider ?? body.gatewayId ?? getDefaultGatewayId();
  if (!isPaymentGatewayId(providerCandidate)) {
    return NextResponse.json({ error: "Proveedor inválido." }, { status: 400 });
  }

  try {
    const result = await createPaymentIntentForSession(session, {
      amount,
      currency: body.currency ?? "USD",
      chargeCurrency: body.chargeCurrency,
      provider: providerCandidate,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({
      ok: true,
      paymentIntent: result,
    });
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message =
      error instanceof Error ? error.message : "No se pudo crear la intención de pago.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
