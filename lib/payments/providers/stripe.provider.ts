import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/env.server";
import {
  ProviderNotConfiguredError,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type PaymentProviderAdapter,
  type VerifiedWebhookEvent,
  type VerifyWebhookInput,
} from "./types";

function stripeConfigured(): boolean {
  return Boolean(serverEnv.stripeSecretKey);
}

function parseStripeSignatureHeader(signatureHeader: string): {
  timestamp?: number;
  signatures: string[];
} {
  const result: { timestamp?: number; signatures: string[] } = { signatures: [] };

  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=");
    if (!key || !value) continue;
    if (key.trim() === "t") result.timestamp = Number(value.trim());
    if (key.trim() === "v1") result.signatures.push(value.trim());
  }

  return result;
}

function safeCompareHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - parsed.timestamp);
  if (ageSeconds > serverEnv.stripeWebhookToleranceSeconds) return false;

  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  return parsed.signatures.some((signature) => safeCompareHex(signature, expected));
}

export class StripePaymentProvider implements PaymentProviderAdapter {
  id = "stripe" as const;

  isConfigured(): boolean {
    return stripeConfigured();
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!stripeConfigured()) {
      throw new ProviderNotConfiguredError("stripe");
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${serverEnv.appUrl}/payments?tab=wallet-tx&status=success`);
    params.set("cancel_url", `${serverEnv.appUrl}/payments?tab=wallet-tx&status=cancelled`);
    params.set("client_reference_id", input.paymentIntentId);
    params.set("metadata[payment_intent_id]", input.paymentIntentId);
    params.set("metadata[organization_id]", input.organizationId);
    params.set("metadata[wallet_id]", input.walletId);
    params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
    params.set("line_items[0][price_data][product_data][name]", "Recarga de cartera");
    params.set("line_items[0][quantity]", "1");
    if (input.customerEmail) {
      params.set("customer_email", input.customerEmail);
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: params.toString(),
    });

    const data = (await response.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!response.ok || !data.id) {
      throw new Error(data.error?.message ?? "No se pudo crear la sesión de Stripe.");
    }

    return {
      providerReference: data.id,
      checkoutUrl: data.url ?? null,
      status: "requires_payment",
      message: "Redirigiendo al checkout de Stripe…",
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent | null> {
    const secret = serverEnv.stripeWebhookSecret;
    const signature = input.signature;

    if (!secret || !signature) {
      if (serverEnv.isProduction) return null;
      return this.parseWebhookPayload(input.rawBody);
    }

    if (!verifyStripeSignature(input.rawBody, signature, secret)) {
      return null;
    }

    return this.parseWebhookPayload(input.rawBody);
  }

  private parseWebhookPayload(payload: string): VerifiedWebhookEvent | null {
    try {
      const data = JSON.parse(payload) as {
        id?: string;
        type?: string;
        data?: {
          object?: {
            id?: string;
            client_reference_id?: string;
            metadata?: { payment_intent_id?: string };
            amount_total?: number;
            amount_received?: number;
            amount?: number;
            currency?: string;
          };
        };
      };

      const object = data.data?.object;
      if (!data.id) return null;

      const providerReference = object?.id ?? null;
      const paymentIntentId =
        object?.metadata?.payment_intent_id ?? object?.client_reference_id ?? undefined;

      return {
        eventId: data.id,
        eventType: data.type ?? "unknown",
        providerReference,
        paymentIntentId,
        amountCents: object?.amount_total ?? object?.amount_received ?? object?.amount,
        currency: object?.currency?.toUpperCase(),
        succeeded:
          data.type === "checkout.session.completed" ||
          data.type === "payment_intent.succeeded",
        failed: data.type === "payment_intent.payment_failed",
        cancelled:
          data.type === "checkout.session.expired" ||
          data.type === "payment_intent.canceled",
      };
    } catch {
      return null;
    }
  }
}
