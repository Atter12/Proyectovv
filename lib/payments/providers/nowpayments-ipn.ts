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

export type NowPaymentsWebhookStep =
  | "credit"
  | "mark_failed"
  | "mark_cancelled"
  | "ack"
  | "flag_underpaid"
  | "ignore_after_credit";

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

/** JSON con claves ordenadas (Node). */
export function nowPaymentsSortedJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/**
 * PHP `json_encode(..., JSON_UNESCAPED_SLASHES)` no escapa `/`.
 * El `json_encode` por defecto sí (`\/`). NOWPayments documenta ambos mundos.
 */
export function nowPaymentsPhpDefaultJson(value: unknown): string {
  return nowPaymentsSortedJson(value).replace(/\//g, "\\/");
}

function hmacSha512Hex(secret: string, payload: string): string {
  return createHmac("sha512", secret).update(payload).digest("hex");
}

function hexEqual(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left.trim(), "utf8");
    const b = Buffer.from(right.trim(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Candidatos de firma: JS sorted, PHP slash-escaped, y el raw del body. */
export function nowPaymentsIpnSignatureCandidates(
  rawBody: string,
  secret: string,
): string[] {
  const digest = new Set<string>();
  digest.add(hmacSha512Hex(secret, rawBody));
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    digest.add(hmacSha512Hex(secret, nowPaymentsSortedJson(parsed)));
    digest.add(hmacSha512Hex(secret, nowPaymentsPhpDefaultJson(parsed)));
  } catch {
    /* raw ya cubierto */
  }
  return [...digest];
}

/** HMAC-SHA512 como documenta NOWPayments; acepta variantes PHP/JSON. */
export function verifyNowPaymentsIpnSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = signature.trim();
  return nowPaymentsIpnSignatureCandidates(rawBody, secret).some((candidate) =>
    hexEqual(candidate, expected),
  );
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

/**
 * NOWPayments a veces recotiza mientras confirma y deja el pago «partially_paid»
 * por centavos aunque el cliente mandó exactamente lo que se le pidió primero.
 * Si lo pagado cubre la PRIMERA cotización, el pago está completo.
 */
export function nowPaymentsCoversFirstQuote(actuallyPaid: number | null | undefined, firstQuote: number | null | undefined): boolean {
  if (actuallyPaid == null || !Number.isFinite(actuallyPaid) || actuallyPaid <= 0) return false;
  if (firstQuote == null || !Number.isFinite(firstQuote) || firstQuote <= 0) return false;
  return actuallyPaid + PAID_EPS >= firstQuote;
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
 *
 * Si la recarga ya está `succeeded`, un refund/fail posterior no baja el estado
 * (el ledger no se revierte desde el IPN).
 */
export function nowPaymentsWebhookStep(
  event: VerifiedWebhookEvent,
  intentStatus?: string | null,
): NowPaymentsWebhookStep {
  if (intentStatus === "succeeded") {
    if (event.succeeded) return "credit";
    if (event.failed || event.cancelled || event.underpaid) {
      return "ignore_after_credit";
    }
    return "ack";
  }
  if (event.failed) return "mark_failed";
  if (event.cancelled) return "mark_cancelled";
  if (event.succeeded) return "credit";
  if (event.underpaid) {
    return event.eventType === "nowpayments.finished"
      ? "mark_failed"
      : "flag_underpaid";
  }
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
  const actuallyPaid = asNumber(body.actually_paid);
  const payAmount = asNumber(body.pay_amount);
  const finished = status === "finished";
  const underpaid =
    status === "partially_paid" || (finished && !paid);
  const succeeded = finished && paid;
  const failed = status === "failed" || status === "refunded";
  const cancelled = status === "expired";

  const amountCents = toUsdCents(body.price_amount, body.price_currency);
  const underpaidKey =
    underpaid && actuallyPaid != null ? `:${actuallyPaid}` : "";

  return {
    eventId: `nowpayments:${invoiceId ?? orderId}:${paymentId ?? "ipn"}:${status || "update"}${underpaidKey}`,
    eventType: `nowpayments.${status || "update"}`,
    providerReference: invoiceId,
    paymentIntentId: orderId ?? undefined,
    amountCents,
    currency: amountCents != null ? "USD" : undefined,
    succeeded,
    failed: failed && !succeeded,
    cancelled: cancelled && !succeeded,
    underpaid,
    actuallyPaid: actuallyPaid ?? undefined,
    payAmount: payAmount ?? undefined,
  };
}
