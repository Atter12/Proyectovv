export const NOWPAYMENTS_INVOICE_TIMEOUT_MS = 20_000;

export function buildNowPaymentsInvoiceBody(input: {
  amountCents: number;
  currency: string;
  paymentIntentId: string;
  appUrl: string;
  payCurrency: string;
  minUsd: number;
}):
  | { ok: true; priceAmount: number; body: Record<string, unknown> }
  | { ok: false; reason: "too_small"; amountUsd: number } {
  const priceAmount = Number((input.amountCents / 100).toFixed(2));
  if (!Number.isFinite(priceAmount) || priceAmount < input.minUsd) {
    return { ok: false, reason: "too_small", amountUsd: priceAmount };
  }

  const origin = input.appUrl.replace(/\/$/, "");
  return {
    ok: true,
    priceAmount,
    body: {
      price_amount: priceAmount,
      price_currency: (input.currency || "USD").toLowerCase(),
      order_id: input.paymentIntentId,
      order_description: `Recarga Holistic ${input.paymentIntentId.slice(0, 8)}`,
      ipn_callback_url: `${origin}/api/webhooks/payments/crypto`,
      success_url: `${origin}/payments?tab=wallet-tx&status=pending_crypto`,
      cancel_url: `${origin}/payments?tab=wallet-tx&status=cancelled`,
      is_fixed_rate: false,
      pay_currency: input.payCurrency,
    },
  };
}

export type NowPaymentsInvoiceResponse = {
  id?: string | number;
  invoice_id?: string | number;
  invoice_url?: string;
  message?: string;
};

export function parseNowPaymentsInvoiceResponse(
  raw: string,
  httpStatus: number,
):
  | { ok: true; invoiceId: string; invoiceUrl: string }
  | { ok: false; message: string } {
  let data: NowPaymentsInvoiceResponse = {};
  const trimmed = raw.trim();
  if (trimmed) {
    try {
      data = JSON.parse(trimmed) as NowPaymentsInvoiceResponse;
    } catch {
      return {
        ok: false,
        message: `NOWPayments no devolvió JSON (HTTP ${httpStatus}).`,
      };
    }
  }

  const invoiceId = data.id ?? data.invoice_id;
  const invoiceUrl = data.invoice_url ?? null;
  if (
    httpStatus < 200 ||
    httpStatus >= 300 ||
    invoiceId == null ||
    !invoiceUrl
  ) {
    return {
      ok: false,
      message:
        data.message ??
        `NOWPayments no pudo crear la factura cripto (HTTP ${httpStatus}).`,
    };
  }

  return {
    ok: true,
    invoiceId: String(invoiceId),
    invoiceUrl,
  };
}
