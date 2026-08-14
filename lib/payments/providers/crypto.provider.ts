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

type NowPaymentsInvoiceResponse = {
  id?: string | number;
  invoice_id?: string | number;
  token_id?: string;
  invoice_url?: string;
  order_id?: string;
  order_description?: string;
  price_amount?: number | string;
  price_currency?: string;
  message?: string;
  status?: boolean;
  code?: string | number;
};

type NowPaymentsIpnBody = {
  payment_id?: string | number;
  invoice_id?: string | number;
  payment_status?: string;
  order_id?: string;
  order_description?: string;
  price_amount?: number | string;
  price_currency?: string;
  pay_amount?: number | string;
  pay_currency?: string;
  actually_paid?: number | string;
  purchase_id?: string | number;
};

function nowPaymentsConfigured(): boolean {
  return Boolean(serverEnv.nowPaymentsApiKey);
}

function nowPaymentsBaseUrl(): string {
  return serverEnv.nowPaymentsSandbox
    ? "https://api-sandbox.nowpayments.io/v1"
    : "https://api.nowpayments.io/v1";
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key]);
    }
    return sorted;
  }
  return value;
}

function verifyNowPaymentsSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const sorted = JSON.stringify(sortKeysDeep(parsed));
    const digest = createHmac("sha512", secret).update(sorted).digest("hex");
    const left = Buffer.from(digest, "utf8");
    const right = Buffer.from(signature, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function toCents(amount: number | string | undefined, currency?: string): number | undefined {
  if (amount == null) return undefined;
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return undefined;
  const cur = (currency ?? "usd").toLowerCase();
  // fiat / stable quoted in major units
  if (["usd", "eur", "usdt", "usdc"].includes(cur) || cur.startsWith("usdt")) {
    return Math.round(n * 100);
  }
  return Math.round(n * 100);
}

/**
 * Cripto:
 * 1) Preferido: NOWPayments invoice + IPN (auto).
 * 2) Fallback: USDT manual + comprobante (revisión admin).
 */
export class CryptoPaymentProvider implements PaymentProviderAdapter {
  id = "crypto" as const;

  isConfigured(): boolean {
    if (nowPaymentsConfigured()) return true;
    return (
      !serverEnv.isProduction ||
      serverEnv.paymentsAllowManualProvider ||
      serverEnv.paymentsManualEnabled
    );
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError("crypto");
    }

    if (!nowPaymentsConfigured()) {
      return {
        providerReference: null,
        checkoutUrl: null,
        status: "requires_payment",
        message:
          "Recarga cripto registrada. Enviá USDT (red indicada por el equipo), subí el comprobante / TxID y esperá la confirmación. El saldo no se acredita solo.",
      };
    }

    const priceAmount = Number((input.amountCents / 100).toFixed(2));
    const body: Record<string, unknown> = {
      price_amount: priceAmount,
      price_currency: (input.currency || "USD").toLowerCase(),
      order_id: input.paymentIntentId,
      order_description: `Recarga Holistic ${input.paymentIntentId.slice(0, 8)}`,
      ipn_callback_url: `${serverEnv.appUrl}/api/webhooks/payments/crypto`,
      success_url: `${serverEnv.appUrl}/payments?status=success`,
      cancel_url: `${serverEnv.appUrl}/payments?status=cancelled`,
      is_fixed_rate: true,
    };

    if (serverEnv.nowPaymentsPayCurrency) {
      body.pay_currency = serverEnv.nowPaymentsPayCurrency;
    }

    const response = await fetch(`${nowPaymentsBaseUrl()}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": serverEnv.nowPaymentsApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as NowPaymentsInvoiceResponse;
    const invoiceId = data.id ?? data.invoice_id;
    const invoiceUrl = data.invoice_url ?? null;

    if (!response.ok || invoiceId == null || !invoiceUrl) {
      throw new Error(
        data.message ??
          `NOWPayments no pudo crear la factura cripto (HTTP ${response.status}).`,
      );
    }

    return {
      providerReference: String(invoiceId),
      checkoutUrl: invoiceUrl,
      status: "requires_payment",
      message: serverEnv.nowPaymentsSandbox
        ? "Redirigiendo a NOWPayments (sandbox)…"
        : "Redirigiendo a checkout cripto…",
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent | null> {
    const signature =
      input.signature ??
      input.headers.get("x-nowpayments-sig") ??
      input.headers.get("x-nowpayments-signature");

    const secret = serverEnv.nowPaymentsIpnSecret;
    if (secret) {
      if (!signature) return null;
      if (!verifyNowPaymentsSignature(input.rawBody, signature, secret)) {
        return null;
      }
    } else if (serverEnv.isProduction) {
      return null;
    }

    return this.parseIpn(input.rawBody);
  }

  private parseIpn(rawBody: string): VerifiedWebhookEvent | null {
    try {
      const body = JSON.parse(rawBody) as NowPaymentsIpnBody;
      const paymentId = body.payment_id ?? body.invoice_id ?? body.purchase_id;
      if (paymentId == null && !body.order_id) return null;

      const status = String(body.payment_status ?? "").toLowerCase();
      const succeeded = status === "finished" || status === "confirmed";
      const failed =
        status === "failed" || status === "expired" || status === "refunded";
      const cancelled = status === "expired";

      return {
        eventId: `nowpayments:${paymentId ?? body.order_id}:${status || "update"}`,
        eventType: `nowpayments.${status || "update"}`,
        providerReference: paymentId != null ? String(paymentId) : null,
        paymentIntentId: body.order_id,
        amountCents: toCents(body.price_amount, body.price_currency),
        currency: body.price_currency?.toUpperCase(),
        succeeded,
        failed: failed && !succeeded,
        cancelled: cancelled && !succeeded,
      };
    } catch {
      return null;
    }
  }
}
