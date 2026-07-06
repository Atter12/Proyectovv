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

interface CulqiWebhookPayload {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      amount?: number;
      currency_code?: string;
      reference_code?: string;
      metadata?: { payment_intent_id?: string; organization_id?: string };
      outcome?: { type?: string; merchant_message?: string };
    };
  };
}

function verifyCulqiSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  if (signature === secret) return true;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export class CulqiPaymentProvider implements PaymentProviderAdapter {
  id = "culqi" as const;

  isConfigured(): boolean {
    return Boolean(serverEnv.culqiPrivateKey || serverEnv.culqiSecretKey);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError("culqi");
    }

    return {
      providerReference: input.paymentIntentId,
      checkoutUrl: null,
      status: "requires_payment",
      message:
        "Culqi está preparado para checkout frontend/tokenización. Usa CULQI_PUBLIC_KEY en cliente y confirma el cargo desde backend antes de acreditar saldo.",
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent | null> {
    const secret = serverEnv.culqiWebhookSecret;
    if (serverEnv.isProduction && secret) {
      const signature =
        input.headers.get("x-culqi-signature") ??
        input.headers.get("x-signature") ??
        input.signature;
      if (!verifyCulqiSignature(input.rawBody, signature, secret)) return null;
    }

    try {
      const payload = JSON.parse(input.rawBody) as CulqiWebhookPayload;
      const object = payload.data?.object;
      const outcome = object?.outcome?.type ?? "";
      const type = payload.type ?? "unknown";

      if (!payload.id) return null;

      return {
        eventId: payload.id,
        eventType: type,
        providerReference: object?.id ?? null,
        paymentIntentId: object?.metadata?.payment_intent_id ?? object?.reference_code,
        amountCents: object?.amount,
        currency: object?.currency_code?.toUpperCase(),
        succeeded:
          type.includes("charge.creation.succeeded") ||
          type.includes("charge.succeeded") ||
          outcome === "venta_exitosa",
        failed:
          type.includes("failed") ||
          type.includes("rejected") ||
          outcome === "venta_fallida",
        cancelled: type.includes("cancel"),
      };
    } catch {
      return null;
    }
  }
}
