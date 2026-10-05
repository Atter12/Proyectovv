import { createHmac, timingSafeEqual } from "node:crypto";
import { STRIPE_DISABLED_MESSAGE } from "../stripe-policy";
import { serverEnv } from "@/lib/env/env.server";
import {
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type PaymentProviderAdapter,
  type VerifiedWebhookEvent,
  type VerifyWebhookInput,
} from "./types";

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
    return false;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    void input;
    throw new Error(STRIPE_DISABLED_MESSAGE);
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
