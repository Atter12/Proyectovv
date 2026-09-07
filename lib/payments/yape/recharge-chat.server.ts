import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/types/auth";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaymentIntentForSession } from "@/lib/payments/create-intent.server";
import {
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { mergeMetadata } from "@/lib/records";
import { getManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
import { isRecord, getNumber, getString } from "@/lib/records";

/**
 * Bot de recarga dentro del chat de soporte.
 *
 * Se mete DELANTE del sistema de tickets: si el mensaje va de recargar, lo
 * atiende el bot y no se crea ticket. Cualquier otra cosa sigue de largo hacia
 * el gerente de siempre. Así la bandeja de soporte no se llena de "quiero
 * recargar" y el cliente tiene respuesta al instante.
 *
 * Es una máquina de estados determinista, no un modelo de lenguaje: respuestas
 * fijas, costo cero y comportamiento auditable.
 */

export type RechargeChatState = "idle" | "awaiting_amount" | "awaiting_payment";

export interface RechargeBotReply {
  id: string;
  text: string;
}

/** Recarga esperando pago, para que el chat sepa a donde mandar la captura. */
export interface PendingRechargeInfo {
  paymentIntentId: string;
  grossPenCents: number;
}

export interface RechargeChatResult {
  /** false = el bot no se hace cargo; que siga al ticket de soporte. */
  handled: boolean;
  state: RechargeChatState;
  replies: RechargeBotReply[];
  paymentIntentId?: string;
  /** QR de Yape, para que el cliente escanee en vez de tipear el numero. */
  qrImageUrl?: string;
}

// --- Detección de intención -------------------------------------------------
// Frases reales de un cliente peruano, con y sin tildes.

const RECHARGE_PATTERNS: RegExp[] = [
  /\brecarg/i,
  /\brechar/i,
  /\babon(ar|o|ame)/i,
  /\bdeposit(ar|o)/i,
  /\bdep[oó]sito/i,
  /\byape(ar|o|arte)?\b/i,
  /\bplin\b/i,
  /\b(?:agregar|a[ñn]adir|cargar|meter|subir|poner|comprar)\s+(?:mi\s+)?(?:saldo|cr[eé]ditos?|plata)\b/i,
  /^\/recarga\b/i,
];

const CANCEL_PATTERNS: RegExp[] = [
  /\bcancel(ar|a|o)\b/i,
  /\banular\b/i,
  /\bolv[ií]dalo\b/i,
  /^\/cancelar\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  const normalized = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return patterns.some((pattern) => pattern.test(normalized));
}

/**
 * Monto en dólares que el cliente quiere en cartera.
 *
 * Preguntamos en dólares y no en soles porque es la moneda de la cartera y la
 * que usa el panel: así el bot y el panel dan siempre el mismo número.
 */
export function extractAmountUsd(text: string): number | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const patterns: RegExp[] = [
    /(?:US\$|\$|USD)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
    /\b([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:d[oó]lares|dolares|usd)\b/i,
    /\b([0-9]+(?:[.,][0-9]{1,2})?)\b/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (!match) continue;
    const parsed = Number.parseFloat(match[1].replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000) return parsed;
  }
  return null;
}

// --- Motor ------------------------------------------------------------------

export async function handleRechargeMessage(input: {
  session: SessionUser;
  message: string;
  clientState?: RechargeChatState;
}): Promise<RechargeChatResult> {
  const text = input.message.trim();
  if (!text) return notHandled();

  const active = await findActiveManualPenIntent(input.session.organizationId);
  const wantsRecharge = matchesAny(text, RECHARGE_PATTERNS);
  const amountUsd = extractAmountUsd(text);

  if (matchesAny(text, CANCEL_PATTERNS) && active) {
    return cancelRecharge(active);
  }

  // Con una recarga en curso, recordamos el monto exacto en vez de abrir otra.
  if (active && (wantsRecharge || input.clientState === "awaiting_payment")) {
    return reply("awaiting_payment", [
      `Ya tenés una recarga en curso: yapea **${formatPenAmount(active.grossPenCents)}** al ${await getYapeNumber()}.`,
      breakdownMessage(active),
      "El monto tiene que ser **exacto**, con los céntimos: así identifico tu pago.",
      "Cuando lo hagas, adjuntá la captura acá mismo con el clip 📎.",
    ]);
  }

  // "quiero recargar 50" resuelve todo de una.
  if (wantsRecharge && amountUsd !== null) {
    return startRecharge(input.session, amountUsd);
  }

  if (wantsRecharge) {
    return reply("awaiting_amount", [
      "¡Claro! ¿Cuánto querés tener en cartera? 💰",
      `Decime el monto en dólares. Mínimo ${formatUsd(minimumCreditUsd())}.`,
    ]);
  }

  // Un número suelto solo cuenta si venimos de preguntar el monto.
  if (input.clientState === "awaiting_amount" && amountUsd !== null) {
    return startRecharge(input.session, amountUsd);
  }

  // No es sobre recargas: que siga al ticket de soporte.
  return notHandled();
}

/**
 * Cancela de verdad la recarga.
 *
 * Antes esto solo respondia "listo, cancelada" sin tocar nada, y el cliente
 * quedaba trabado: al pedir otra recarga le decia que ya tenia una en curso.
 *
 * Con el comprobante ya subido no se cancela: esa recarga esta en la cola de
 * revision de soporte, y sacarla de ahi dejaria al cliente sin su plata y sin
 * nadie mirando el caso.
 */
async function cancelRecharge(active: ActiveRecharge): Promise<RechargeChatResult> {
  if (active.status === "processing") {
    return reply("awaiting_payment", [
      "Esa recarga ya tiene tu comprobante y está en revisión, así que no la puedo cancelar.",
      "Si te equivocaste, escribime y un gerente la revisa.",
    ]);
  }

  const intent = await getPaymentIntentByIdInternal(active.id);
  await updatePaymentIntentRecord(active.id, {
    status: "cancelled",
    canceledAt: new Date().toISOString(),
    metadata: mergeMetadata(intent?.metadata, {
      cancelled_from: "recharge_chat",
      manual_review_status: "cancelled",
    }),
  });

  return reply("idle", [
    "Listo, cancelé esa recarga. El monto queda libre.",
    "Si ya habías yapeado, escribime y un gerente lo revisa — no la vuelvas a pagar.",
    "Cuando quieras arrancar otra, escribí *quiero recargar*.",
  ]);
}

async function startRecharge(
  session: SessionUser,
  amountUsd: number,
): Promise<RechargeChatResult> {
  try {
    const result = await createPaymentIntentForSession(session, {
      amount: amountUsd,
      provider: "manual",
      chargeCurrency: "PEN",
      idempotencyKey: randomUUID(),
    });

    const intent = await findActiveManualPenIntent(session.organizationId);
    const monto = intent ? formatPenAmount(intent.grossPenCents) : "el monto indicado";
    const numero = await getYapeNumber();

    const cuenta = getYapeAccount();

    return {
      handled: true,
      state: "awaiting_payment",
      paymentIntentId: result.paymentIntentId,
      ...(cuenta?.qrImageUrl ? { qrImageUrl: cuenta.qrImageUrl } : {}),
      replies: toReplies([
        `Listo. Yapeá **${monto}** al **${numero}**${
          getYapeAccount()?.holder ? ` (${getYapeAccount()?.holder})` : ""
        }.`,
        intent
          ? breakdownMessage(intent)
          : `Se acreditan ${formatUsd(amountUsd)} en tu cartera.`,
        "Tiene que ser el monto **exacto**, céntimos incluidos: esos céntimos son los que me dicen que el pago es tuyo.",
        "Cuando hayas yapeado, adjuntá la captura acá con el clip 📎 y el saldo entra solo.",
      ]),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No pude generar la recarga.";
    // Los errores de monto mínimo y de tipo de cambio ya vienen redactados
    // para el cliente desde create-intent.
    return reply("awaiting_amount", [message, "¿Con qué monto lo intentamos?"]);
  }
}

/** Crédito mínimo en USD que produce un cobro por encima del umbral del banco. */
function minimumCreditUsd(): number {
  const rate = serverEnv.holisticUsdPenRate || 3.48;
  const minPen = serverEnv.yapeMinNotifiablePen;
  // +1% de margen para no quedar pegado justo en el umbral.
  return Math.ceil((minPen / rate) * 1.01 * 100) / 100;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function getYapeAccount() {
  return getManualBankAccounts("PEN")[0] ?? null;
}

async function getYapeNumber(): Promise<string> {
  return getYapeAccount()?.accountNumber ?? "el número que figura en Pagos";
}

/** Recarga manual en soles todavía esperando pago. */
interface ActiveRecharge {
  id: string;
  status: string;
  /** Lo que el cliente yapea: saldo + comisión. */
  grossPenCents: number;
  /** La parte que se convierte en saldo. */
  creditPenCents: number;
  /** La comisión Holistic, en soles. */
  feePenCents: number;
  feePercent: number;
  /** Lo que entra a la cartera, en dólares. */
  creditUsdCents: number;
}

async function findActiveManualPenIntent(
  organizationId: string | null | undefined,
): Promise<ActiveRecharge | null> {
  if (!organizationId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_intents")
    .select("id, status, amount_cents, metadata")
    .eq("organization_id", organizationId)
    .eq("provider", "manual")
    .eq("currency", "PEN")
    .in("status", ["created", "requires_payment", "processing"])
    .gte(
      "created_at",
      new Date(
        Date.now() - serverEnv.yapeMatchWindowMinutes * 60_000,
      ).toISOString(),
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      status: string;
      amount_cents: number;
      metadata: Record<string, unknown> | null;
    }>();

  if (!data) return null;

  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const num = (key: string, fallback: number): number => {
    const value = getNumber(metadata[key]);
    return value !== null && value > 0 ? Math.round(value) : fallback;
  };

  const grossPenCents = num("gross_pen_cents", data.amount_cents);
  const creditPenCents = num("credit_pen_cents", grossPenCents);

  return {
    id: data.id,
    status: data.status,
    grossPenCents,
    creditPenCents,
    feePenCents: num("fee_pen_cents", Math.max(0, grossPenCents - creditPenCents)),
    feePercent: getNumber(metadata.fee_percent) ?? 10,
    creditUsdCents: num("credit_amount_cents", 0),
  };
}

/**
 * Desglose de lo que el cliente yapea.
 *
 * Lo pedimos explícito: el monto a enviar incluye la comisión Holistic, pero
 * el saldo que recibe es sin ella. Si el bot solo dijera el total, el cliente
 * vería que le acreditan menos de lo que pagó y pensaría que falta plata.
 */
function buildBreakdown(active: ActiveRecharge): string[] {
  const lineas = [
    `• ${formatPenAmount(active.creditPenCents)} → tu saldo${
      active.creditUsdCents > 0 ? ` (${formatUsd(active.creditUsdCents / 100)})` : ""
    }`,
  ];

  if (active.feePenCents > 0) {
    lineas.push(
      `• ${formatPenAmount(active.feePenCents)} → comisión Holistic (${active.feePercent}%)`,
    );
  }

  return lineas;
}

/** El desglose como un solo mensaje del bot, una línea por concepto. */
function breakdownMessage(active: ActiveRecharge): string {
  return ["Ese monto se compone así:", ...buildBreakdown(active)].join("\n");
}

/**
 * Recarga viva del usuario, si la hay.
 *
 * El chat la consulta antes de mandar un adjunto: si existe, la captura es un
 * comprobante de pago y va al validador, no al ticket de soporte.
 */
export async function getPendingRecharge(
  session: SessionUser,
): Promise<PendingRechargeInfo | null> {
  const active = await findActiveManualPenIntent(session.organizationId);
  if (!active) return null;
  return { paymentIntentId: active.id, grossPenCents: active.grossPenCents };
}

/** Estado del bot al abrir el chat, para retomar una recarga en curso. */
export async function getRechargeChatSnapshot(
  session: SessionUser,
): Promise<RechargeChatResult> {
  const active = await findActiveManualPenIntent(session.organizationId);
  if (!active) return notHandled();

  const cuenta = getYapeAccount();
  return {
    ...reply("awaiting_payment", [
      `Tenés una recarga en curso: yapea **${formatPenAmount(active.grossPenCents)}** al ${await getYapeNumber()}.`,
      "Cuando lo hagas, adjuntá la captura acá con el clip 📎.",
    ]),
    ...(cuenta?.qrImageUrl ? { qrImageUrl: cuenta.qrImageUrl } : {}),
  };
}

export function readIntentIdFromMetadata(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  return getString(metadata.payment_intent_id);
}

// --- Helpers ----------------------------------------------------------------

function toReplies(texts: string[]): RechargeBotReply[] {
  return texts.map((text) => ({ id: randomUUID(), text }));
}

function reply(state: RechargeChatState, texts: string[]): RechargeChatResult {
  return { handled: true, state, replies: toReplies(texts) };
}

function notHandled(): RechargeChatResult {
  return { handled: false, state: "idle", replies: [] };
}
