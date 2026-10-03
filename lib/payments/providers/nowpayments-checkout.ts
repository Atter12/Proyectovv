import { isBelowCryptoMinimum } from "../crypto-limits.ts";

export function buildNowPaymentsInvoiceBody(input: {
  amountCents: number;
  currency: string;
  paymentIntentId: string;
  appUrl: string;
  payCurrency: string;
}):
  | { ok: true; priceAmount: number; body: Record<string, unknown> }
  | { ok: false; reason: "too_small"; amountUsd: number } {
  const priceAmount = Number((input.amountCents / 100).toFixed(2));
  if (isBelowCryptoMinimum(priceAmount)) {
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
      success_url: `${origin}/payments?status=success`,
      cancel_url: `${origin}/payments?status=cancelled`,
      is_fixed_rate: false,
      pay_currency: input.payCurrency,
    },
  };
}
