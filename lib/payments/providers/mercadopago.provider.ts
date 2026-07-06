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

function parseSignatureHeader(value: string | null): Record<string, string> {
  if (!value) return {};
  return value.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, raw] = part.split("=");
    if (key && raw) acc[key.trim()] = raw.trim();
    return acc;
  }, {});
}

function compareHex(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function normalizeTimestamp(ts: string): number | null {
  const parsed = Number(ts);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 10_000_000_000 ? parsed / 1000 : parsed;
}

function verifyMercadoPagoSignature(input: VerifyWebhookInput, dataId: string | undefined): boolean {
  const secret = serverEnv.mercadoPagoWebhookSecret;
  if (!secret) return !serverEnv.isProduction;

  const parsed = parseSignatureHeader(input.headers.get("x-signature"));
  const ts = parsed.ts;
  const signature = parsed.v1;
  const requestId = input.headers.get("x-request-id") ?? "";

  if (!ts || !signature || !requestId || !dataId) return false;

  const timestampSeconds = normalizeTimestamp(ts);
  if (!timestampSeconds) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > serverEnv.mercadoPagoWebhookToleranceSeconds) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return compareHex(signature, expected);
}

interface MercadoPagoPaymentDetails {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string;
  metadata?: Record<string, unknown>;
}

export class MercadoPagoPaymentProvider implements PaymentProviderAdapter {
  id = "mercadopago" as const;

  isConfigured(): boolean {
    return Boolean(serverEnv.mercadoPagoAccessToken);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError("mercadopago");
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: "Recarga de cartera",
            quantity: 1,
            unit_price: input.amountCents / 100,
            currency_id: input.currency.toUpperCase(),
          },
        ],
        external_reference: input.paymentIntentId,
        metadata: {
          payment_intent_id: input.paymentIntentId,
          organization_id: input.organizationId,
          wallet_id: input.walletId,
        },
        notification_url: `${serverEnv.appUrl}/api/webhooks/payments/mercadopago`,
        back_urls: {
          success:
            serverEnv.mercadoPagoSuccessUrl ||
            `${serverEnv.appUrl}/payments?tab=wallet-tx&status=success`,
          failure:
            serverEnv.mercadoPagoFailureUrl ||
            `${serverEnv.appUrl}/payments?tab=wallet-tx&status=failed`,
          pending:
            serverEnv.mercadoPagoPendingUrl ||
            `${serverEnv.appUrl}/payments?tab=wallet-tx&status=pending`,
        },
        auto_return: "approved",
      }),
    });

    const data = (await response.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      message?: string;
    };

    if (!response.ok || !data.id) {
      throw new Error(data.message ?? "No se pudo crear la preferencia de Mercado Pago.");
    }

    return {
      providerReference: data.id,
      checkoutUrl: data.init_point ?? data.sandbox_init_point ?? null,
      status: "requires_payment",
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent | null> {
    try {
      const data = JSON.parse(input.rawBody) as {
        id?: string | number;
        type?: string;
        action?: string;
        data?: { id?: string };
      };

      const eventId = String(data.id ?? `${data.action ?? data.type}:${data.data?.id ?? ""}`);
      const paymentId = data.data?.id;
      if (!paymentId || !eventId) return null;

      if (!verifyMercadoPagoSignature(input, paymentId)) return null;

      const payment = await this.fetchPayment(paymentId);
      if (!payment) return null;

      const status = payment.status ?? "unknown";
      const paymentIntentId =
        payment.external_reference ??
        (typeof payment.metadata?.payment_intent_id === "string"
          ? payment.metadata.payment_intent_id
          : undefined);

      return {
        eventId,
        eventType: data.action ?? data.type ?? "payment.updated",
        providerReference: String(payment.id ?? paymentId),
        paymentIntentId,
        amountCents:
          typeof payment.transaction_amount === "number"
            ? Math.round(payment.transaction_amount * 100)
            : undefined,
        currency: payment.currency_id?.toUpperCase(),
        succeeded: status === "approved" || status === "accredited",
        failed: ["rejected", "cancelled", "refunded", "charged_back"].includes(status),
        cancelled: status === "cancelled",
      };
    } catch {
      return null;
    }
  }

  private async fetchPayment(paymentId: string): Promise<MercadoPagoPaymentDetails | null> {
    if (!this.isConfigured()) return null;

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${serverEnv.mercadoPagoAccessToken}`,
      },
    });

    if (!response.ok) return null;
    return (await response.json()) as MercadoPagoPaymentDetails;
  }
}
