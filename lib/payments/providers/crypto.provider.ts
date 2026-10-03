import { serverEnv } from "@/lib/env/env.server";
import {
  ProviderNotConfiguredError,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type PaymentProviderAdapter,
  type VerifiedWebhookEvent,
  type VerifyWebhookInput,
} from "./types";
import { CRYPTO_MIN_USD } from "@/lib/payments/crypto-limits";
import { parseNowPaymentsIpn, verifyNowPaymentsIpnSignature } from "./nowpayments-ipn";
import { buildNowPaymentsInvoiceBody } from "./nowpayments-checkout";

export class CryptoAmountTooSmallError extends Error {
  constructor(amountUsd: number) {
    super(
      `El pago con USDT (TRC20) requiere un mínimo de $${CRYPTO_MIN_USD}. ` +
        `Solicitaste $${amountUsd.toFixed(2)}. Usa Yape, transferencia o sube el monto.`,
    );
    this.name = "CryptoAmountTooSmallError";
  }
}

type NowPaymentsInvoiceResponse = {
  id?: string | number;
  invoice_id?: string | number;
  invoice_url?: string;
  message?: string;
};

function nowPaymentsConfigured(): boolean {
  return Boolean(serverEnv.nowPaymentsApiKey && serverEnv.nowPaymentsIpnSecret);
}

function nowPaymentsBaseUrl(): string {
  return serverEnv.nowPaymentsSandbox
    ? "https://api-sandbox.nowpayments.io/v1"
    : "https://api.nowpayments.io/v1";
}

/** Cripto = NOWPayments. Sin API key no aparece como pasarela. */
export class CryptoPaymentProvider implements PaymentProviderAdapter {
  id = "crypto" as const;

  isConfigured(): boolean {
    return nowPaymentsConfigured();
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!nowPaymentsConfigured()) {
      throw new ProviderNotConfiguredError("crypto");
    }

    const invoice = buildNowPaymentsInvoiceBody({
      amountCents: input.amountCents,
      currency: input.currency,
      paymentIntentId: input.paymentIntentId,
      appUrl: serverEnv.appUrl,
      payCurrency: serverEnv.nowPaymentsPayCurrency,
    });
    if (!invoice.ok) {
      throw new CryptoAmountTooSmallError(invoice.amountUsd);
    }

    const response = await fetch(`${nowPaymentsBaseUrl()}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": serverEnv.nowPaymentsApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoice.body),
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
    if (!secret || !signature) return null;
    if (!verifyNowPaymentsIpnSignature(input.rawBody, signature, secret)) {
      return null;
    }

    return parseNowPaymentsIpn(input.rawBody);
  }
}
