import { createHmac, timingSafeEqual } from "node:crypto";
import type { SavedCardEvent, VerifiedWebhookEvent } from "./types";

function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseSignatureHeader(header: string): string[] {
  // Standard Webhooks: "v1,sig" space-separated if multiple.
  return header
    .split(/\s+/)
    .map((part) => {
      const comma = part.indexOf(",");
      if (comma < 0) return null;
      const version = part.slice(0, comma).trim();
      const sig = part.slice(comma + 1).trim();
      if (version !== "v1" || !sig) return null;
      return sig;
    })
    .filter((value): value is string => Boolean(value));
}

/**
 * Whop Standard Webhooks: HMAC-SHA256 of `{id}.{timestamp}.{body}`,
 * key = secret `ws_…` tal cual; firma en base64 bajo `v1,`.
 */
export function verifyWhopWebhookSignature(input: {
  rawBody: string;
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean {
  const {
    rawBody,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    secret,
    toleranceSeconds = 300,
    nowSeconds = Math.floor(Date.now() / 1000),
  } = input;

  if (!secret || !webhookId || !webhookTimestamp || !webhookSignature) {
    return false;
  }

  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) return false;

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("base64");

  return parseSignatureHeader(webhookSignature).some((candidate) =>
    safeEqualString(candidate, expected),
  );
}

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!metadata) return undefined;
  const value = metadata[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function dollarsToCents(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return undefined;
}

function nullableNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Setup intent de Whop (tarjeta guardada). Webhooks fijados antes de la
 * versión 2026-09-22-1 traen el método como `payment_method.id`.
 */
export function parseWhopSavedCard(data: unknown): SavedCardEvent | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.status !== undefined && row.status !== "succeeded") return null;
  const legacyMethod =
    row.payment_method && typeof row.payment_method === "object"
      ? (row.payment_method as Record<string, unknown>).id
      : undefined;
  const paymentMethodId = typeof row.payment_method_id === "string" && row.payment_method_id
    ? row.payment_method_id
    : typeof legacyMethod === "string" ? legacyMethod : "";
  const memberId =
    typeof row.member_id === "string"
      ? row.member_id
      : row.member && typeof row.member === "object" &&
          typeof (row.member as Record<string, unknown>).id === "string"
        ? String((row.member as Record<string, unknown>).id)
        : "";
  const setupIntentId = typeof row.id === "string" ? row.id : "";
  if (!paymentMethodId || !memberId || !setupIntentId) return null;
  const instrument =
    row.payment_instrument && typeof row.payment_instrument === "object"
      ? (row.payment_instrument as Record<string, unknown>)
      : null;
  const card =
    instrument?.card && typeof instrument.card === "object"
      ? (instrument.card as Record<string, unknown>)
      : null;
  return {
    setupIntentId,
    memberId,
    paymentMethodId,
    brand: typeof card?.brand === "string" ? card.brand : null,
    last4: typeof card?.last4 === "string" ? card.last4 : null,
    expMonth: nullableNumber(card?.exp_month),
    expYear: nullableNumber(card?.exp_year),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

export function parseWhopWebhookPayload(payload: string): VerifiedWebhookEvent | null {
  try {
    const envelope = JSON.parse(payload) as {
      id?: string;
      type?: string;
      data?: {
        id?: string;
        metadata?: Record<string, unknown> | null;
        total?: unknown;
        usd_total?: unknown;
        subtotal?: unknown;
        currency?: string;
        status?: string;
        failure_message?: string | null;
      };
    };

    const eventType = envelope.type ?? "unknown";
    const eventId = typeof envelope.id === "string" ? envelope.id : null;
    if (!eventId) return null;

    const data = envelope.data;
    const metadata = data?.metadata ?? null;

    if (eventType === "setup_intent.succeeded") {
      return {
        eventId,
        eventType,
        providerReference: typeof data?.id === "string" ? data.id : null,
        succeeded: false,
        failed: false,
        cancelled: false,
        savedCard: parseWhopSavedCard(data) ?? undefined,
      };
    }
    const paymentIntentId =
      metadataString(metadata, "payment_intent_id") ??
      metadataString(metadata, "paymentIntentId");

    // Cobro en USD: vale `total`, lo que se cobró. `usd_total` es la conversión
    // de Whop y puede venir redondeada (Jheferson 09/10/2026: total 113,
    // usd_total 112.95 → se rechazó un pago completo). `usd_total` solo se usa
    // si el cliente pagó en otra moneda.
    const paidCurrency = data?.currency?.toUpperCase();
    const paidCents = dollarsToCents(data?.total) ?? dollarsToCents(data?.subtotal);
    const usdCents = dollarsToCents(data?.usd_total);
    const inUsd = paidCurrency === "USD" || paidCurrency === undefined;
    const amountCents = inUsd ? (paidCents ?? usdCents) : (usdCents ?? paidCents);
    const currency =
      inUsd ? paidCurrency : usdCents !== undefined ? "USD" : paidCurrency;

    return {
      eventId,
      eventType,
      providerReference: typeof data?.id === "string" ? data.id : null,
      paymentIntentId,
      amountCents,
      currency,
      succeeded: eventType === "payment.succeeded",
      failed: eventType === "payment.failed",
      cancelled:
        eventType === "payment.canceled" || eventType === "payment.cancelled",
      ...(typeof data?.failure_message === "string" && data.failure_message.trim()
        ? { failureMessage: data.failure_message.trim().slice(0, 300) }
        : {}),
    };
  } catch {
    return null;
  }
}
