import { serverEnv } from "@/lib/env/env.server";
import {
  ProviderNotConfiguredError,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type PaymentProviderAdapter,
  type VerifiedWebhookEvent,
  type VerifyWebhookInput,
} from "./types";
import {
  WHOP_CHECKOUT_TIMEOUT_MS,
  buildWhopCheckoutBody,
  parseWhopCheckoutResponse,
} from "./whop-checkout";
import {
  parseWhopWebhookPayload,
  verifyWhopWebhookSignature,
} from "./whop-webhook";

function whopConfigured(): boolean {
  return Boolean(
    serverEnv.whopApiKey &&
      serverEnv.whopCompanyId &&
      serverEnv.whopWebhookSecret,
  );
}

export class WhopPaymentProvider implements PaymentProviderAdapter {
  id = "whop" as const;

  isConfigured(): boolean {
    return whopConfigured();
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!whopConfigured()) {
      throw new ProviderNotConfiguredError("whop");
    }

    const redirectUrl = `${serverEnv.appUrl}/payments?tab=wallet-tx&status=whop_return`;
    const body = buildWhopCheckoutBody({
      companyId: serverEnv.whopCompanyId,
      amountCents: input.amountCents,
      currency: input.currency,
      paymentIntentId: input.paymentIntentId,
      organizationId: input.organizationId,
      walletId: input.walletId,
      redirectUrl,
      productId: serverEnv.whopProductId || undefined,
      concept: input.concept,
      customerEmail: input.customerEmail,
    });

    const response = await fetch(
      `${serverEnv.whopApiBaseUrl.replace(/\/$/, "")}/checkout_configurations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverEnv.whopApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Api-Version-Date": serverEnv.whopApiVersionDate,
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WHOP_CHECKOUT_TIMEOUT_MS),
      },
    );

    const data = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!response.ok) {
      const err = data?.error;
      let message = `Whop checkout falló (${response.status}).`;
      if (
        err &&
        typeof err === "object" &&
        typeof (err as { message?: unknown }).message === "string"
      ) {
        message = (err as { message: string }).message;
      } else if (typeof data?.message === "string") {
        message = data.message;
      }
      throw new Error(message);
    }

    const parsed = parseWhopCheckoutResponse(data);
    if (!parsed) {
      throw new Error("Whop no devolvió el enlace de checkout.");
    }

    return {
      providerReference: parsed.id,
      checkoutUrl: parsed.purchaseUrl,
      status: "requires_payment",
      message: "Redirigiendo al checkout de Whop…",
      resultMetadata: {
        whop_mode: "checkout_configuration",
        whop_checkout_id: parsed.id,
      },
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent | null> {
    const secret = serverEnv.whopWebhookSecret;
    if (!secret) {
      if (serverEnv.isProduction) return null;
      return parseWhopWebhookPayload(input.rawBody);
    }

    const ok = verifyWhopWebhookSignature({
      rawBody: input.rawBody,
      webhookId: input.headers.get("webhook-id"),
      webhookTimestamp: input.headers.get("webhook-timestamp"),
      webhookSignature:
        input.signature ?? input.headers.get("webhook-signature"),
      secret,
      toleranceSeconds: serverEnv.whopWebhookToleranceSeconds,
    });

    if (!ok) return null;
    return parseWhopWebhookPayload(input.rawBody);
  }
}
