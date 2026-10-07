import { NextResponse } from "next/server";
import { processSuccessfulPaymentIntent } from "@/lib/payments/create-intent.server";
import { recordCryptoIpnOpsEvent } from "@/lib/payments/crypto-ipn-ops.server";
import { getPaymentProvider } from "@/lib/payments/providers";
import { nowPaymentsWebhookStep } from "@/lib/payments/providers/nowpayments-ipn";
import {
  getPaymentIntentByProviderReference,
  getPaymentIntentByIdInternal,
  markWebhookEventFailed,
  markWebhookEventProcessed,
  mergePaymentIntentMetadata,
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
  if (provider === "cobrana") {
    return request.headers.get("x-cobrana-signature");
  }
  if (provider === "crypto") {
    return (
      request.headers.get("x-nowpayments-sig") ??
      request.headers.get("x-nowpayments-signature")
    );
  }
  if (provider === "whop") {
    return request.headers.get("webhook-signature");
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
    const intent =
      (parsed.paymentIntentId
        ? await getPaymentIntentByIdInternal(parsed.paymentIntentId)
        : null) ??
      (parsed.providerReference
        ? await getPaymentIntentByProviderReference(provider, parsed.providerReference)
        : null);

    if (provider === "crypto") {
      const step = nowPaymentsWebhookStep(parsed, intent?.status ?? null);
      const gapMeta = {
        crypto_ipn_status: parsed.eventType,
        crypto_underpaid: Boolean(parsed.underpaid),
        crypto_actually_paid: parsed.actuallyPaid ?? null,
        crypto_pay_amount: parsed.payAmount ?? null,
      };

      if (step === "credit") {
        await processSuccessfulPaymentIntent({
          provider,
          providerReference: parsed.providerReference,
          paymentIntentId: parsed.paymentIntentId,
          amountCents: parsed.amountCents,
          currency: parsed.currency,
          webhookEventId: parsed.eventId,
        });
      } else if (step === "mark_failed" && intent) {
        await updatePaymentIntentRecord(intent.id, {
          status: "failed",
          failureReason: parsed.eventType,
        });
        await mergePaymentIntentMetadata(intent.id, gapMeta);
        await recordCryptoIpnOpsEvent({
          intentId: intent.id,
          organizationId: intent.organizationId,
          action: parsed.underpaid
            ? "payment_intent.crypto_underpaid"
            : "payment_intent.crypto_failed",
          metadata: gapMeta,
        });
      } else if (step === "mark_cancelled" && intent) {
        await updatePaymentIntentRecord(intent.id, {
          status: "cancelled",
          canceledAt: new Date().toISOString(),
          failureReason: parsed.eventType,
        });
        await mergePaymentIntentMetadata(intent.id, gapMeta);
      } else if (step === "flag_underpaid" && intent) {
        await mergePaymentIntentMetadata(intent.id, {
          ...gapMeta,
          crypto_awaiting_remaining: true,
        });
        await recordCryptoIpnOpsEvent({
          intentId: intent.id,
          organizationId: intent.organizationId,
          action: "payment_intent.crypto_underpaid",
          metadata: { ...gapMeta, still_open: true },
        });
      } else if (step === "ignore_after_credit" && intent) {
        await mergePaymentIntentMetadata(intent.id, {
          crypto_ipn_after_credit: parsed.eventType,
          ...gapMeta,
        });
        await recordCryptoIpnOpsEvent({
          intentId: intent.id,
          organizationId: intent.organizationId,
          action: "payment_intent.crypto_ipn_after_credit",
          metadata: gapMeta,
        });
      }

      await markWebhookEventProcessed(provider, parsed.eventId);
      return NextResponse.json({ ok: true, step });
    }

    if (parsed.failed) {
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
