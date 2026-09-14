import { createHash } from "node:crypto";

/**
 * Parser de avisos de abono BCP (transferencia) y Binance Pay.
 * No cubre Yapeo: ese camino sigue en lib/payments/yape.
 */

export type ManualBankRail = "bcp_transfer" | "binance" | "unknown";
export type ManualBankCurrency = "PEN" | "USD";
export type NotificationDirection = "inbound" | "outbound" | "unknown";

export interface ParsedManualBankNotification {
  amountCents: number | null;
  currency: ManualBankCurrency | null;
  operationNumber: string | null;
  senderName: string | null;
  rail: ManualBankRail;
  direction: NotificationDirection;
}

const YAPE_MARKERS: RegExp[] = [
  /\byapeo?\b/i,
  /recibiste\s+un\s+yape/i,
  /constancia\s+de\s+recepci[oó]n\s+de\s+yape/i,
  /te\s+yape[oó]/i,
];

const BINANCE_MARKERS: RegExp[] = [
  /\bbinance\b/i,
  /binance\s*pay/i,
  /pay\.binance/i,
];

const BCP_TRANSFER_MARKERS: RegExp[] = [
  /constancia\s+de\s+transferencia/i,
  /transferencia\s+(?:recibida|interbancaria|a\s+cuenta)/i,
  /abono\s+en\s+(?:tu\s+)?cuenta/i,
  /dep[oó]sito\s+recibido/i,
  /has\s+recibido\s+una\s+transferencia/i,
  /recibiste\s+una\s+transferencia/i,
  /transferencia\s+recibida/i,
];

const OUTBOUND_PATTERNS: RegExp[] = [
  /realizaste\s+una\s+transferencia/i,
  /monto\s+enviado/i,
  /transferencia\s+enviada/i,
  /\benviaste\b/i,
  /you\s+sent\b/i,
  /payment\s+sent\b/i,
  /realizaste\s+un\s+consumo/i,
];

const INBOUND_PATTERNS: RegExp[] = [
  /monto\s+recibido/i,
  /abono\s+en\s+(?:tu\s+)?cuenta/i,
  /transferencia\s+recibida/i,
  /dep[oó]sito\s+recibido/i,
  /has\s+recibido/i,
  /recibiste\b/i,
  /you\s+(?:have\s+)?received\b/i,
  /payment\s+received\b/i,
  /successfully\s+received\b/i,
  /te\s+(?:enviaron|depositaron|abonaron)\b/i,
];

const PEN_AMOUNT_PATTERNS: RegExp[] = [
  /(?:S\/\.?|PEN|SOLES)\s*([0-9]{1,3}(?:[.,][0-9]{3})*|[0-9]+)[.,]([0-9]{2})\b/i,
  /\b([0-9]{1,3}(?:[.,][0-9]{3})*|[0-9]+)[.,]([0-9]{2})\s*(?:soles|PEN)\b/i,
];

const USD_AMOUNT_PATTERNS: RegExp[] = [
  /(?:US\$|USD|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\.([0-9]{2})\b/i,
  /\b([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\.([0-9]{2})\s*(?:USD|US\$|d[oó]lares?)\b/i,
  /(?:US\$|USD|\$)\s*([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+),([0-9]{2})\b/i,
];

const OPERATION_PATTERNS: RegExp[] = [
  /(?:n(?:°|º|ro\.?|umero)?\s*(?:de\s*)?operaci[oó]n|c[oó]digo\s*de\s*operaci[oó]n|operaci[oó]n)\s*[:#]?\s*([A-Za-z0-9-]{4,64})/i,
  /(?:id\s*(?:de\s*la\s*)?transacci[oó]n|transaction\s*id|order\s*id)\s*[:#]?\s*([A-Za-z0-9-]{6,64})/i,
  /(?:reference|referencia)\s*[:#]?\s*([A-Za-z0-9-]{6,64})/i,
];

const SENDER_PATTERNS: RegExp[] = [
  /(?:enviado\s+por|from|de parte de|remitente)\s*[:]?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ0-9.@\s_-]{3,80})/i,
  /(?:recibiste|has\s+recibido).{0,40}?\bde\s+([A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{3,60})/i,
];

/** ¿Es un aviso Yape? Esos no entran al matcher de pago manual. */
export function looksLikeYapeNotification(text: string): boolean {
  return YAPE_MARKERS.some((pattern) => pattern.test(text));
}

export function classifyManualBankRail(text: string): ManualBankRail {
  if (BINANCE_MARKERS.some((pattern) => pattern.test(text))) return "binance";
  if (BCP_TRANSFER_MARKERS.some((pattern) => pattern.test(text))) {
    return "bcp_transfer";
  }
  return "unknown";
}

export function classifyDirection(text: string): NotificationDirection {
  if (OUTBOUND_PATTERNS.some((pattern) => pattern.test(text))) return "outbound";
  if (INBOUND_PATTERNS.some((pattern) => pattern.test(text))) return "inbound";
  return "unknown";
}

export function parseManualBankNotificationText(
  text: string,
): ParsedManualBankNotification {
  const normalized = text.replace(/\s+/g, " ").trim();
  const rail = classifyManualBankRail(normalized);
  const direction = classifyDirection(normalized);

  const usd = extractUsdAmountCents(normalized);
  const pen = extractPenAmountCents(normalized);

  // Preferencia: si el rail es Binance, USD primero; si BCP, PEN primero.
  let amountCents: number | null = null;
  let currency: ManualBankCurrency | null = null;
  if (rail === "binance") {
    if (usd !== null) {
      amountCents = usd;
      currency = "USD";
    } else if (pen !== null) {
      amountCents = pen;
      currency = "PEN";
    }
  } else if (pen !== null) {
    amountCents = pen;
    currency = "PEN";
  } else if (usd !== null) {
    amountCents = usd;
    currency = "USD";
  }

  return {
    amountCents,
    currency,
    operationNumber: extractOperationNumber(normalized),
    senderName: extractSenderName(normalized),
    rail,
    direction,
  };
}

function extractPenAmountCents(text: string): number | null {
  for (const pattern of PEN_AMOUNT_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const whole = match[1].replace(/[.,]/g, "");
    const cents = match[2];
    const parsed = Number.parseInt(`${whole}${cents}`, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function extractUsdAmountCents(text: string): number | null {
  for (const pattern of USD_AMOUNT_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const whole = match[1].replace(/[.,]/g, "");
    const cents = match[2];
    const parsed = Number.parseInt(`${whole}${cents}`, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function looksLikeOperationNumber(value: string): boolean {
  return /\d{4,}/.test(value);
}

function extractOperationNumber(text: string): string | null {
  for (const pattern of OPERATION_PATTERNS) {
    const value = pattern.exec(text)?.[1]?.trim();
    if (value && looksLikeOperationNumber(value)) return value;
  }
  return null;
}

function extractSenderName(text: string): string | null {
  for (const pattern of SENDER_PATTERNS) {
    const value = pattern.exec(text)?.[1]?.replace(/\s+/g, " ").split(/\.\s/)[0]?.trim();
    if (value && value.length >= 3) return value.slice(0, 80);
  }
  return null;
}

/** Prefijo distinto al de Yape para no colisionar fingerprints/ops en la misma tabla. */
export function buildManualBankFingerprint(input: {
  source: string;
  operationNumber: string | null;
  amountCents: number;
  currency: string;
  senderName: string | null;
  receivedAt: string;
  rawText: string | null;
}): string {
  if (input.operationNumber) {
    return `manual:op:${input.currency.toLowerCase()}:${input.operationNumber.toLowerCase()}`;
  }

  const secondBucket = input.receivedAt.slice(0, 19);
  const payload = [
    "manual",
    input.source,
    input.currency,
    String(input.amountCents),
    (input.senderName ?? "").toLowerCase(),
    secondBucket,
    input.rawText ?? "",
  ].join("|");

  return `manual:h:${createHash("sha256").update(payload).digest("hex").slice(0, 40)}`;
}
