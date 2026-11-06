import { NextResponse } from "next/server";
import { processSuccessfulPaymentIntent } from "@/lib/payments/create-intent.server";
import { recordCryptoIpnOpsEvent } from "@/lib/payments/crypto-ipn-ops.server";
import {
  finalizeStripeCardSetup,
  recordAutochargeFailure,
  recordAutochargeSuccess,
  saveWhopCardFromSetup,
} from "@/lib/payments/credit-card/credit-card.server";
import { getPaymentProvider } from "@/lib/payments/providers";
import { loadNowPaymentsReconciliation } from "@/lib/payments/providers/nowpayments-reconciliation.server";
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

  if (recorded.duplicate && provider !== "crypto") {
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
      if (!intent || intent.provider !== "crypto" || !intent.providerReference ||
          parsed.providerReference !== intent.providerReference ||
          parsed.paymentIntentId !== intent.id) {
        throw new Error("NOWPayments invoice/order does not match the payment intent");
      }
      // Always reconcile the complete verified history, including retries and late IPNs.
      const total = await loadNowPaymentsReconciliation(intent);
      const alreadyCredited = intent.status === "succeeded";
      const step = alreadyCredited ? "ignore_after_credit" : total.canCredit ? "credit" :
        total.needsReview ? "review" : total.hasSettled ? "flag_underpaid" :
        parsed.failed ? "mark_failed" : parsed.cancelled ? "mark_cancelled" : "ack";
      const gapMeta = {
        crypto_ipn_status: parsed.eventType,
        crypto_actually_paid: total.actuallyPaid,
        crypto_pay_amount: total.payAmount,
        crypto_pay_currency: total.currency,
        crypto_payment_ids: total.paymentIds,
        crypto_reconciliation_needs_review: total.needsReview,
        crypto_reconciliation_version: 2,
        crypto_underpaid: !alreadyCredited && !total.canCredit && total.hasSettled,
        crypto_awaiting_remaining: !alreadyCredited && !total.canCredit && total.hasSettled && !total.needsReview,
        crypto_underpaid_absorbed: total.absorbed,
      };
      if (step === "credit") {
        await processSuccessfulPaymentIntent({
          provider,
          providerReference: intent.providerReference,
          paymentIntentId: intent.id,
          amountCents: intent.amountCents,
          currency: intent.currency,
          webhookEventId: parsed.eventId,
        });
        await mergePaymentIntentMetadata(intent.id, gapMeta);
      } else if (!alreadyCredited) {
        // Conditional write prevents an older partial IPN from overwriting a concurrent credit.
        await mergePaymentIntentMetadata(intent.id, gapMeta, { unlessSucceeded: true });
        if (step === "mark_failed" || step === "mark_cancelled") {
          await updatePaymentIntentRecord(intent.id, {
            status: step === "mark_failed" ? "failed" : "cancelled",
            failureReason: parsed.eventType,
          }, { unlessSucceeded: true });
        }
      }
      await recordCryptoIpnOpsEvent({
        intentId: intent.id,
        organizationId: intent.organizationId,
        action: `payment_intent.crypto_${step}`,
        metadata: gapMeta,
      });
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

    // Stripe: tarjeta del crédito guardada (Checkout en modo setup). Respaldo por si
    // el cliente no vuelve a Pagos después de registrarla.
    if (provider === "stripe" && parsed.stripeSetupSessionId) {
      const saved = await finalizeStripeCardSetup({ sessionId: parsed.stripeSetupSessionId });
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
        if ((provider === "whop" || provider === "stripe") && intent.status !== "succeeded") {
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
      if ((provider === "whop" || provider === "stripe") && intent) {
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
