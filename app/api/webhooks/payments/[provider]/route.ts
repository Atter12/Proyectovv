import { NextResponse } from "next/server";
import { processSuccessfulPaymentIntent } from "@/lib/payments/create-intent.server";
import { getPaymentProvider } from "@/lib/payments/providers";
import {
  getPaymentIntentByProviderReference,
  getPaymentIntentByIdInternal,
  markWebhookEventFailed,
  markWebhookEventProcessed,
  recordWebhookEvent,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { serverEnv } from "@/lib/env/env.server";
import { isPaymentGatewayId } from "@/types/payment";
import type { PaymentGatewayId } from "@/types/payment";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

function getWebhookSignature(request: Request, provider: PaymentGatewayId): string | null {
  if (provider === "stripe") {
    return request.headers.get("stripe-signature");
  }
  return (
    request.headers.get("x-signature") ??
    request.headers.get("x-hub-signature") ??
    request.headers.get("x-mercadopago-signature")
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { provider: providerParam } = await context.params;

  if (!isPaymentGatewayId(providerParam)) {
    return NextResponse.json({ error: "Proveedor inválido." }, { status: 400 });
  }

  const provider = providerParam;
  const rawBody = await request.text();
  const signature = getWebhookSignature(request, provider);
  const providerImpl = getPaymentProvider(provider);

  if (!providerImpl.verifyWebhook) {
    return NextResponse.json({ error: "Webhook no soportado." }, { status: 400 });
  }

  const parsed = await providerImpl.verifyWebhook({
    rawBody,
    signature,
    headers: request.headers,
  });

  if (!parsed) {
    if (serverEnv.isProduction) {
      return NextResponse.json({ error: "Firma inválida o payload no verificable." }, {
        status: 401,
      });
    }
    return NextResponse.json({ ok: true, ignored: true });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    payload = { raw: rawBody };
  }

  const recorded = await recordWebhookEvent({
    provider,
    eventId: parsed.eventId,
    eventType: parsed.eventType,
    payload,
  });

  if (recorded.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (parsed.failed) {
      const intent =
        (parsed.paymentIntentId
          ? await getPaymentIntentByIdInternal(parsed.paymentIntentId)
          : null) ??
        (parsed.providerReference
          ? await getPaymentIntentByProviderReference(provider, parsed.providerReference)
          : null);

      if (intent) {
        await updatePaymentIntentRecord(intent.id, {
          status: "failed",
          failureReason: parsed.eventType,
        });
      }

      await markWebhookEventProcessed(provider, parsed.eventId);
      return NextResponse.json({ ok: true });
    }

    if (parsed.cancelled) {
      const intent =
        (parsed.paymentIntentId
          ? await getPaymentIntentByIdInternal(parsed.paymentIntentId)
          : null) ??
        (parsed.providerReference
          ? await getPaymentIntentByProviderReference(provider, parsed.providerReference)
          : null);
      if (intent) {
        await updatePaymentIntentRecord(intent.id, {
          status: "cancelled",
          canceledAt: new Date().toISOString(),
        });
      }
      await markWebhookEventProcessed(provider, parsed.eventId);
      return NextResponse.json({ ok: true });
    }

    if (parsed.succeeded) {
      await processSuccessfulPaymentIntent({
        provider,
        providerReference: parsed.providerReference,
        paymentIntentId: parsed.paymentIntentId,
        amountCents: parsed.amountCents,
        currency: parsed.currency,
        webhookEventId: parsed.eventId,
      });
    }

    await markWebhookEventProcessed(provider, parsed.eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error procesando webhook";
    await markWebhookEventFailed(provider, parsed.eventId, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
