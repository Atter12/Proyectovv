import { NextResponse } from "next/server";
import { processSuccessfulPaymentIntent } from "@/lib/payments/create-intent.server";
import { recordCryptoIpnOpsEvent } from "@/lib/payments/crypto-ipn-ops.server";
import {
  recordAutochargeFailure,
  recordAutochargeSuccess,
  saveWhopCardFromSetup,
} from "@/lib/payments/credit-card/credit-card.server";
import { getPaymentProvider } from "@/lib/payments/providers";
import { nowPaymentsWebhookStep } from "@/lib/payments/providers/nowpayments-ipn";
import { nowPaymentsPaidFirstQuote } from "@/lib/payments/providers/nowpayments-first-quote.server";
import {
  getPaymentIntentByProviderReference,
  getPaymentIntentByIdInternal,
  markWebhookEventFailed,
  markWebhookEventProcessed,
  mergePaymentIntentMetadata,
  recordWebhookEvent,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { getInternalIntentIdFromStripePaymentIntent } from "@/lib/payments/stripe-billing.server";
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
      let step = nowPaymentsWebhookStep(parsed, intent?.status ?? null);
      // Recotización: si «falta» plata pero el cliente pagó la primera cotización, se acredita.
      if ((step === "flag_underpaid" || (step === "mark_failed" && parsed.underpaid)) && intent && intent.status !== "succeeded") {
        const quote = await nowPaymentsPaidFirstQuote(intent.id, parsed.actuallyPaid);
        if (quote.covers) {
          step = "credit";
          await mergePaymentIntentMetadata(intent.id, {
            crypto_credited_on_first_quote: {
              first_quote: quote.firstQuote,
              actually_paid: parsed.actuallyPaid ?? null,
              requoted_pay_amount: parsed.payAmount ?? null,
              status: parsed.eventType,
            },
          });
        }
      }
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

    // Tarjeta guardada para el crédito Holistic (anti-vivos).
    if (provider === "whop" && parsed.eventType === "setup_intent.succeeded") {
      const saved = parsed.savedCard
        ? await saveWhopCardFromSetup(parsed.savedCard)
        : { saved: false, reason: "sin_datos" };
      await markWebhookEventProcessed(provider, parsed.eventId);
      return NextResponse.json({ ok: true, ...saved });
    }

    // Stripe: reembolso o disputa. No se descuenta solo (el saldo puede estar ya en TikTok):
    // se marca el pago y queda en audit_logs para que gerencia decida.
    if (provider === "stripe" && parsed.reversal) {
      const internalId =
        intent?.id ??
        (parsed.stripePaymentIntentRef
          ? await getInternalIntentIdFromStripePaymentIntent(parsed.stripePaymentIntentRef)
          : null);
      const target = internalId ? await getPaymentIntentByIdInternal(internalId) : null;
      if (target) {
        const reversalMeta = {
          stripe_reversal: parsed.reversal,
          stripe_reversal_event: parsed.eventType,
          stripe_reversal_amount_cents: parsed.amountCents ?? null,
          stripe_reversal_reason: parsed.reversalReason ?? null,
          stripe_reversal_at: new Date().toISOString(),
          stripe_reversal_needs_review: true,
        };
        await mergePaymentIntentMetadata(target.id, reversalMeta);
        await recordCryptoIpnOpsEvent({
          intentId: target.id,
          organizationId: target.organizationId,
          action:
            parsed.reversal === "refund"
              ? "payment_intent.stripe_refunded"
              : "payment_intent.stripe_disputed",
          metadata: reversalMeta,
        });
      } else {
        console.warn("[webhooks/stripe] reversal sin pago interno", {
          eventId: parsed.eventId,
          stripePaymentIntent: parsed.stripePaymentIntentRef,
        });
      }
      await markWebhookEventProcessed(provider, parsed.eventId);
      return NextResponse.json({ ok: true, reversal: parsed.reversal, matched: Boolean(target) });
    }

    if (parsed.failed) {
      if (intent) {
        await updatePaymentIntentRecord(intent.id, {
          status: "failed",
          failureReason: parsed.failureMessage ?? parsed.eventType,
        });
        if (provider === "whop" && intent.status !== "succeeded") {
          await recordAutochargeFailure(intent, parsed.failureMessage ?? null);
        }
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
      if (provider === "whop" && intent) {
        await recordAutochargeSuccess(intent);
      }
    }

    await markWebhookEventProcessed(provider, parsed.eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error procesando webhook";
    await markWebhookEventFailed(provider, parsed.eventId, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
