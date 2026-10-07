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
import {
  buildNowPaymentsInvoiceBody,
  NOWPAYMENTS_INVOICE_TIMEOUT_MS,
  parseNowPaymentsInvoiceResponse,
} from "./nowpayments-checkout";

export class CryptoAmountTooSmallError extends Error {
  constructor(amountUsd: number) {
    super(
      `El pago con USDT (TRC20) requiere un mínimo de $${CRYPTO_MIN_USD}. ` +
        `Solicitaste $${amountUsd.toFixed(2)}. Usa Yape, transferencia o sube el monto.`,
    );
    this.name = "CryptoAmountTooSmallError";
  }
}

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
      minUsd: CRYPTO_MIN_USD,
    });
    if (!invoice.ok) {
      throw new CryptoAmountTooSmallError(invoice.amountUsd);
    }

    let response: Response;
    try {
      response = await fetch(`${nowPaymentsBaseUrl()}/invoice`, {
        method: "POST",
        headers: {
          "x-api-key": serverEnv.nowPaymentsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoice.body),
        signal: AbortSignal.timeout(NOWPAYMENTS_INVOICE_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      throw new Error(
        timedOut
          ? "NOWPayments tardó demasiado en crear la factura. Inténtalo de nuevo."
          : "No se pudo conectar con NOWPayments. Inténtalo de nuevo.",
      );
    }

    const raw = await response.text();
    const parsed = parseNowPaymentsInvoiceResponse(raw, response.status);
    if (!parsed.ok) {
      throw new Error(parsed.message);
    }

    return {
      providerReference: parsed.invoiceId,
      checkoutUrl: parsed.invoiceUrl,
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
