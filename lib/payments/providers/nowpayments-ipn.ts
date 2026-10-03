import { createHmac, timingSafeEqual } from "node:crypto";
import type { VerifiedWebhookEvent } from "./types";

/** Polvo de red: 0.01 USDT. Menos que eso no cuenta como falta de pago. */
const PAID_EPS = 0.01;

export interface NowPaymentsIpnBody {
  payment_id?: string | number;
  invoice_id?: string | number;
  payment_status?: string;
  order_id?: string;
  price_amount?: number | string;
  price_currency?: string;
  pay_amount?: number | string;
  actually_paid?: number | string;
  purchase_id?: string | number;
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

/** HMAC-SHA512 del JSON con claves ordenadas, como documenta NOWPayments. */
export function verifyNowPaymentsIpnSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const sorted = JSON.stringify(sortKeysDeep(parsed));
    const digest = createHmac("sha512", secret).update(sorted).digest("hex");
    const left = Buffer.from(digest, "utf8");
    const right = Buffer.from(signature.trim(), "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function asNumber(value: number | string | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asId(value: string | number | undefined): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/** Lo enviado cubre lo pedido en cripto. No usamos el USD de lista. */
export function nowPaymentsPaidInFull(body: NowPaymentsIpnBody): boolean {
  const actuallyPaid = asNumber(body.actually_paid);
  const payAmount = asNumber(body.pay_amount);
  if (actuallyPaid == null || actuallyPaid < 0) return false;
  if (payAmount == null || payAmount <= 0) return false;
  return actuallyPaid + PAID_EPS >= payAmount;
}

function toUsdCents(amount: number | string | undefined, currency?: string): number | undefined {
  if (amount == null) return undefined;
  const n = asNumber(amount);
  if (n == null) return undefined;
  const cur = (currency ?? "usd").toLowerCase();
  if (cur !== "usd" && cur !== "eur") return undefined;
  return Math.round(n * 100);
}

/**
 * Solo `finished` acredita. `confirmed` todavía puede fallar.
 * El id que guardamos al crear la factura es `invoice_id`, no `payment_id`.
 */
export function nowPaymentsWebhookStep(
  event: VerifiedWebhookEvent,
): "credit" | "mark_failed" | "mark_cancelled" | "ack" {
  if (event.failed) return "mark_failed";
  if (event.cancelled) return "mark_cancelled";
  if (event.succeeded) return "credit";
  return "ack";
}

/** Misma regla que processSuccessfulPaymentIntent: si el IPN trae monto, tiene que ser el de la recarga. */
export function nowPaymentsAmountMatchesIntent(
  event: VerifiedWebhookEvent,
  intent: { amountCents: number; currency: string },
): boolean {
  if (event.amountCents !== undefined && event.amountCents !== intent.amountCents) return false;
  if (event.currency !== undefined && event.currency.toUpperCase() !== intent.currency.toUpperCase()) {
    return false;
  }
  return true;
}

export function parseNowPaymentsIpn(rawBody: string): VerifiedWebhookEvent | null {
  let body: NowPaymentsIpnBody;
  try {
    body = JSON.parse(rawBody) as NowPaymentsIpnBody;
  } catch {
    return null;
  }

  const invoiceId = asId(body.invoice_id);
  const orderId = asId(body.order_id);
  const paymentId = asId(body.payment_id) ?? asId(body.purchase_id);
  if (!invoiceId && !orderId) return null;

  const status = String(body.payment_status ?? "").toLowerCase();
  const paid = nowPaymentsPaidInFull(body);
  const succeeded = status === "finished" && paid;
  const failed = status === "failed" || status === "refunded";
  const cancelled = status === "expired";

  const amountCents = toUsdCents(body.price_amount, body.price_currency);

  return {
    eventId: `nowpayments:${invoiceId ?? orderId}:${paymentId ?? "ipn"}:${status || "update"}`,
    eventType: `nowpayments.${status || "update"}`,
    providerReference: invoiceId,
    paymentIntentId: orderId ?? undefined,
    amountCents,
    currency: amountCents != null ? "USD" : undefined,
    succeeded,
    failed: failed && !succeeded,
    cancelled: cancelled && !succeeded,
  };
}
