import { createHmac, timingSafeEqual } from "node:crypto";
import type { VerifiedWebhookEvent } from "./types";

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
      };
    };

    const eventType = envelope.type ?? "unknown";
    const eventId = typeof envelope.id === "string" ? envelope.id : null;
    if (!eventId) return null;

    const data = envelope.data;
    const metadata = data?.metadata ?? null;
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
    };
  } catch {
    return null;
  }
}
