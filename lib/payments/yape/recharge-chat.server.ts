import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/types/auth";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPaymentIntentRecord,
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { resolveDepositFeeForSession } from "@/lib/payments/resolve-hecom-deposit-fee.server";
import {
  depositFromDesiredCredit,
  effectiveDepositFeePercent,
} from "@/lib/payments/deposit-fee";
import {
  buildManualDepositQuote,
  resolveUsdPenRateForQuote,
} from "@/lib/payments/manual-deposit.server";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
import { getNumber, getString, isRecord, mergeMetadata } from "@/lib/records";
import { completeBankConfirmedDeposit } from "./confirm-deposit.server";
import { reserveUniquePenAmount } from "./reserve-amount.server";
import { RECHARGE_BOT_SOURCE, YAPE_RECIPIENT } from "./recipient";

/**
 * Bot de recarga dentro del chat de soporte.
 *
 * Se mete DELANTE del sistema de tickets: si el mensaje va de recargar, lo
 * atiende el bot y no se crea ticket. Cualquier otra cosa sigue de largo hacia
 * el gerente de siempre.
 *
 * Es una máquina de estados determinista, no un modelo de lenguaje: respuestas
 * fijas, costo cero y comportamiento auditable.
 *
 * Crea sus propias recargas en vez de usar createPaymentIntentForSession, que
 * es la de la recarga manual: esa le manda al cliente un correo con las cuentas
 * BCP de transferencia, y aquí el pago va por Yape a otro destino.
 */

export type RechargeChatState = "idle" | "awaiting_amount" | "awaiting_payment";

export interface RechargeBotReply {
  id: string;
  text: string;
}

export interface PendingRechargeInfo {
  paymentIntentId: string;
  grossPenCents: number;
  status: string;
}

export interface RechargeChatResult {
  /** false = el bot no se hace cargo; que siga al ticket de soporte. */
  handled: boolean;
  state: RechargeChatState;
  replies: RechargeBotReply[];
  intent?: { id: string; status: string } | null;
}

/** Error con texto listo para mostrarle al cliente. */
export class RechargeBotUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RechargeBotUserError";
  }
}

// --- Detección de intención -------------------------------------------------
// Frases reales de un cliente peruano, con y sin tildes.

const RECHARGE_PATTERNS: RegExp[] = [
  /\brecarg/i,
  /\brechar/i,
  /\babon(ar|o|ame)/i,
  /\bdeposit(ar|o)/i,
  /\bdeposito/i,
  /\byape(ar|o|arte)?\b/i,
  /\bplin\b/i,
  /\b(?:agregar|anadir|cargar|meter|subir|poner|comprar)\s+(?:mi\s+)?(?:saldo|creditos?|plata)\b/i,
  /^\/recarga\b/i,
];

const CANCEL_PATTERNS: RegExp[] = [
  /\bcancel(ar|a|o)\b/i,
  /\banular?\b/i,
  /\bolvidalo\b/i,
  /^\/cancelar\b/i,
];

const STATUS_PATTERNS: RegExp[] = [
  /\bya\s+pague\b/i,
  /\bya\s+yape/i,
  /\bestado\b/i,
  /\bmi\s+recarga\b/i,
];

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  const normalized = normalize(text);
  return patterns.some((pattern) => pattern.test(normalized));
}

/**
 * Monto en dólares que el cliente quiere en cartera.
 *
 * Se pregunta en dólares porque es la moneda de la cartera y la que usa el
 * panel: así el bot y el panel dan siempre el mismo número.
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

  let active = await findActiveBotIntent(input.session.organizationId);

  // Cualquier mensaje sirve de disparador: si el banco ya confirmó pero la
  // recarga quedó sin cerrar, se cierra aquí. Quien escribe "cancelar" o
  // "ya pagué" en realidad está pidiendo que la miremos.
  if (active) {
    await retryIfBankAlreadyConfirmed(active.id);
    const fresh = await getPaymentIntentByIdInternal(active.id);
    if (fresh?.status === "succeeded") {
      return reply("idle", [
        "🎉 ¡Listo! El banco confirmó tu pago y el saldo ya está en tu cartera.",
      ], { id: active.id, status: "succeeded" });
    }
    if (fresh && fresh.status !== active.status) {
      active = await findActiveBotIntent(input.session.organizationId);
    }
  }

  const wantsCancel = matchesAny(text, CANCEL_PATTERNS);
  const wantsStatus = matchesAny(text, STATUS_PATTERNS);
  const wantsRecharge = matchesAny(text, RECHARGE_PATTERNS);
  const amountUsd = extractAmountUsd(text);
  const inConversation = input.clientState && input.clientState !== "idle";

  if (wantsCancel) {
    if (active) return cancelRecharge(active);
    if (inConversation) {
      return reply("idle", [
        "No tienes ninguna recarga en curso, así que no hay nada que cancelar.",
        "Cuando quieras hacer una, escribe «quiero recargar».",
      ]);
    }
    return notHandled();
  }

  // Con una recarga en curso, recordamos el monto exacto en vez de abrir otra.
  if (active && (wantsRecharge || wantsStatus || input.clientState === "awaiting_payment")) {
    return activeRechargeReply(active);
  }

  if (wantsStatus && inConversation) {
    return reply("idle", [
      "No tienes ninguna recarga en curso.",
      "Si quieres hacer una, escribe «quiero recargar».",
    ]);
  }

  // "quiero recargar 50" resuelve todo de una vez.
  if (wantsRecharge && amountUsd !== null) {
    return startRecharge(input.session, amountUsd);
  }

  if (wantsRecharge) {
    return reply("awaiting_amount", [
      "¡Claro! ¿Cuánto quieres tener en tu cartera? 💰",
      `Dime el monto en dólares. Mínimo ${formatUsd(minimumCreditUsd())}.`,
    ]);
  }

  // Un número suelto solo cuenta si venimos de preguntar el monto.
  if (input.clientState === "awaiting_amount" && amountUsd !== null) {
    return startRecharge(input.session, amountUsd);
  }

  if (input.clientState === "awaiting_amount") {
    return reply("awaiting_amount", [
      "No entendí el monto. Escríbelo en dólares, por ejemplo: 20.",
      "Si prefieres no recargar, escribe «cancelar».",
    ]);
  }

  // No es sobre recargas: que siga al ticket de soporte.
  return notHandled();
}

function activeRechargeReply(active: ActiveRecharge): RechargeChatResult {
  const intent = { id: active.id, status: active.status };

  if (active.status === "processing" && active.voucherConfirmed === false) {
    // La captura no se pudo validar sola: la tiene un gerente, no el banco.
    return reply(
      "awaiting_payment",
      [
        `Tu comprobante de ${formatPenAmount(active.grossPenCents)} está con un gerente para revisión.`,
        "Te avisamos apenas lo revise. No vuelvas a pagar.",
      ],
      intent,
    );
  }

  if (active.status === "processing") {
    return reply(
      "awaiting_payment",
      [
        `Ya recibí tu comprobante de ${formatPenAmount(active.grossPenCents)}.`,
        "Estoy esperando la confirmación del banco, suele tardar uno o dos minutos. Te aviso aquí apenas entre el saldo.",
        "No vuelvas a pagar.",
      ],
      intent,
    );
  }

  return reply(
    "awaiting_payment",
    [
      `Ya tienes una recarga en curso: yapea exactamente ${formatPenAmount(active.grossPenCents)} al número ${YAPE_RECIPIENT.phoneDisplay}.`,
      recipientInstructions(),
      breakdownMessage(active),
      "Cuando lo hagas, adjunta aquí la captura con el clip 📎.",
      "Si prefieres anularla, escribe «cancelar».",
    ],
    intent,
  );
}

/**
 * Cancela de verdad la recarga.
 *
 * Con el comprobante ya subido no se cancela: esa recarga está esperando al
 * banco o en la cola del gerente, y sacarla de ahí dejaría al cliente sin su
 * plata y sin nadie mirando el caso.
 */
async function cancelRecharge(active: ActiveRecharge): Promise<RechargeChatResult> {
  if (active.status === "processing") {
    return reply(
      "awaiting_payment",
      [
        "Esa recarga ya tiene tu comprobante y está en validación, así que no la puedo cancelar.",
        "Si te equivocaste, escríbeme y un gerente la revisa.",
      ],
      { id: active.id, status: active.status },
    );
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

  return reply(
    "idle",
    [
      "Listo, cancelé esa recarga.",
      "Si ya habías yapeado, escríbeme y un gerente lo revisa. No la vuelvas a pagar.",
      "Cuando quieras hacer otra, escribe «quiero recargar».",
    ],
    { id: active.id, status: "cancelled" },
  );
}

async function startRecharge(
  session: SessionUser,
  amountUsd: number,
): Promise<RechargeChatResult> {
  try {
    const intentId = await createBotIntent(session, amountUsd);
    const active = await findActiveBotIntent(session.organizationId);
    if (!active || active.id !== intentId) {
      throw new RechargeBotUserError("No pude generar la recarga. Inténtalo de nuevo.");
    }

    return reply(
      "awaiting_payment",
      [
        `Listo. Yapea exactamente ${formatPenAmount(active.grossPenCents)} al número ${YAPE_RECIPIENT.phoneDisplay}.`,
        recipientInstructions(),
        breakdownMessage(active),
        "Tiene que ser el monto exacto, céntimos incluidos: así sé que el pago es tuyo.",
        "Cuando hayas yapeado, adjunta aquí la captura con el clip 📎 y el saldo entra solo.",
      ],
      { id: active.id, status: active.status },
    );
  } catch (error) {
    const message =
      error instanceof RechargeBotUserError
        ? error.message
        : "No pude generar la recarga en este momento.";
    if (!(error instanceof RechargeBotUserError)) {
      console.error("[recharge-chat] no se pudo crear la recarga", error);
    }
    return reply("awaiting_amount", [message, "¿Con qué monto lo intentamos?"]);
  }
}

function recipientInstructions(): string {
  return `Al poner el número en Yape, elige la opción ${YAPE_RECIPIENT.bank}. Te va a aparecer el nombre ${YAPE_RECIPIENT.holder}: verifica que sea ese antes de pagar.`;
}

/**
 * Crea la recarga del bot con el mismo cálculo que el panel (fee del cliente,
 * tipo de cambio SBS congelado) más céntimos únicos para reconocer el pago.
 */
async function createBotIntent(session: SessionUser, amountUsd: number): Promise<string> {
  const organizationId = session.organizationId;
  if (!organizationId) {
    throw new RechargeBotUserError("Tu cuenta no tiene una cartera activa. Escríbenos y lo revisamos.");
  }

  const creditCents = Math.round(amountUsd * 100);
  if (creditCents <= 0) {
    throw new RechargeBotUserError("El monto tiene que ser mayor a cero.");
  }

  const feeBase = await resolveDepositFeeForSession({ userId: session.id, creditCents });
  const feePercent = effectiveDepositFeePercent({
    holisticFeePercent: feeBase.feePercent,
    provider: "manual",
  });
  const fee = { ...feeBase, ...depositFromDesiredCredit(creditCents, feePercent), feePercent };

  const usdPenRate = await resolveUsdPenRateForQuote();
  const quote = buildManualDepositQuote({
    creditUsd: amountUsd,
    feePercent,
    chargeCurrency: "PEN",
    usdPenRate,
  });

  // El BCP solo avisa por yapeos que superan este umbral. Sin aviso no hay
  // forma de verificar el cobro, así que se rechaza antes de crear la recarga.
  const minCents = Math.round(serverEnv.yapeMinNotifiablePen * 100);
  if (quote.grossChargeCents <= minCents) {
    throw new RechargeBotUserError(
      `Por Yape el total tiene que superar ${formatPenAmount(minCents)}. Con ${formatUsd(amountUsd)} el total sería ${formatPenAmount(quote.grossChargeCents)}. Prueba con al menos ${formatUsd(minimumCreditUsd())}.`,
    );
  }

  let reserved: { amountCents: number; discriminatorCents: number };
  try {
    reserved = await reserveUniquePenAmount(quote.grossChargeCents);
  } catch (error) {
    throw new RechargeBotUserError(
      error instanceof Error ? error.message : "No pude reservar el monto. Inténtalo de nuevo.",
    );
  }

  const walletId = await resolveWalletId(organizationId);
  const intent = await createPaymentIntentRecord({
    organizationId,
    walletId,
    amountCents: reserved.amountCents,
    currency: "PEN",
    provider: "manual",
    createdBy: session.id,
    idempotencyKey: randomUUID(),
    metadata: {
      provider: "manual",
      source: RECHARGE_BOT_SOURCE,
      input_mode: "desired_credit",
      hecom_cliente_id: fee.hecomClienteId,
      hecom_cliente_name: fee.hecomClienteName,
      fee_percent: fee.feePercent,
      fee_holistic_percent: feeBase.feePercent,
      fee_stripe_surcharge_percent: 0,
      fee_source: fee.feeSource,
      fee_amount_cents: fee.feeCents,
      credit_amount_cents: fee.creditCents,
      gross_amount_cents: fee.grossCents,
      wallet_credit_currency: "USD",
      charge_currency: "PEN",
      fx_rate_usd_pen: quote.fxRateUsdPen,
      credit_pen_cents: quote.creditPenCents,
      gross_pen_cents: reserved.amountCents,
      gross_pen_cents_base: quote.grossPenCents,
      fee_pen_cents: quote.feePenCents,
      pen_discriminator_cents: reserved.discriminatorCents,
      gross_usd_cents: quote.grossUsdCents,
      yape_recipient_phone: YAPE_RECIPIENT.phone,
    },
  });

  await updatePaymentIntentRecord(intent.id, { status: "requires_payment" });
  return intent.id;
}

/** Cartera activa de la organización (misma regla que la recarga del panel). */
async function resolveWalletId(organizationId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wallets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new RechargeBotUserError("Tu cuenta no tiene una cartera activa. Escríbenos y lo revisamos.");
  }
  return data.id;
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

/** Recarga del bot todavía abierta. */
interface ActiveRecharge {
  id: string;
  status: string;
  /** Lo que el cliente yapea: saldo + comisión + céntimos de identificación. */
  grossPenCents: number;
  creditPenCents: number;
  feePenCents: number;
  discriminatorCents: number;
  feePercent: number;
  creditUsdCents: number;
  /** null = todavía sin captura; false = la IA no la pudo validar. */
  voucherConfirmed: boolean | null;
}

async function findActiveBotIntent(
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
    .contains("metadata", { source: RECHARGE_BOT_SOURCE })
    .in("status", ["created", "requires_payment", "processing"])
    .gte(
      "created_at",
      new Date(Date.now() - serverEnv.yapeMatchWindowMinutes * 60_000).toISOString(),
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
    return value !== null && value >= 0 ? Math.round(value) : fallback;
  };

  const grossPenCents = num("gross_pen_cents", data.amount_cents);
  const creditPenCents = num("credit_pen_cents", grossPenCents);

  return {
    id: data.id,
    status: data.status,
    grossPenCents,
    creditPenCents,
    feePenCents: num("fee_pen_cents", 0),
    discriminatorCents: num("pen_discriminator_cents", 0),
    feePercent: getNumber(metadata.fee_percent) ?? 10,
    creditUsdCents: num("credit_amount_cents", 0),
    voucherConfirmed: isRecord(metadata.voucher_analysis)
      ? metadata.voucher_analysis.confirmed === true
      : null,
  };
}

/**
 * Desglose de lo que el cliente yapea.
 *
 * El monto incluye la comisión y los céntimos de identificación, pero el saldo
 * que recibe es sin ellos. Si el bot solo dijera el total, el cliente vería
 * que le acreditan menos de lo que pagó y pensaría que falta plata.
 */
function breakdownMessage(active: ActiveRecharge): string {
  const lines = [
    "Ese monto se compone así:",
    `• ${formatPenAmount(active.creditPenCents)} → tu saldo${
      active.creditUsdCents > 0 ? ` (${formatUsd(active.creditUsdCents / 100)})` : ""
    }`,
  ];
  if (active.feePenCents > 0) {
    lines.push(`• ${formatPenAmount(active.feePenCents)} → comisión Holistic (${active.feePercent}%)`);
  }
  if (active.discriminatorCents > 0) {
    lines.push(`• ${formatPenAmount(active.discriminatorCents)} → céntimos para identificar tu pago`);
  }
  return lines.join("\n");
}

/** Recarga viva del usuario, si la hay: a ella va la captura que suba. */
export async function getPendingRecharge(
  session: SessionUser,
): Promise<PendingRechargeInfo | null> {
  const active = await findActiveBotIntent(session.organizationId);
  if (!active) return null;

  // El aviso del banco puede haber llegado ANTES que el comprobante. Se
  // reintenta mientras el cliente espera, que es justo cuando importa.
  await retryIfBankAlreadyConfirmed(active.id);
  const fresh = await getPaymentIntentByIdInternal(active.id);

  return {
    paymentIntentId: active.id,
    grossPenCents: active.grossPenCents,
    status: fresh?.status ?? active.status,
  };
}

/** Estado de una recarga del bot de esta organización, para el aviso del chat. */
export async function getBotIntentStatus(
  session: SessionUser,
  intentId: string,
): Promise<{ id: string; status: string } | null> {
  const intent = await getPaymentIntentByIdInternal(intentId);
  if (!intent || intent.organizationId !== session.organizationId) return null;
  if (!isRecord(intent.metadata) || intent.metadata.source !== RECHARGE_BOT_SOURCE) return null;

  if (intent.status !== "succeeded") {
    await retryIfBankAlreadyConfirmed(intent.id);
    const fresh = await getPaymentIntentByIdInternal(intent.id);
    return { id: intent.id, status: fresh?.status ?? intent.status };
  }
  return { id: intent.id, status: intent.status };
}

/**
 * Vuelve a intentar cerrar una recarga cuyo cobro ya confirmó el banco.
 *
 * Sin esto, una recarga que quedó esperando el comprobante se queda colgada
 * aunque la plata esté: el aviso solo se procesa una vez.
 */
export async function retryIfBankAlreadyConfirmed(intentId: string): Promise<void> {
  try {
    const intent = await getPaymentIntentByIdInternal(intentId);
    if (!intent || intent.status === "succeeded") return;

    const metadata = isRecord(intent.metadata) ? intent.metadata : {};
    const notificationId = getString(metadata.bank_confirmation_notification_id);
    if (!getString(metadata.bank_confirmed_at) || !notificationId) return;

    await completeBankConfirmedDeposit({
      intentId,
      notificationId,
      operationNumber: getString(metadata.bank_confirmation_operation_number),
    });
  } catch (error) {
    // Nunca debe romper la consulta del chat.
    console.warn("[recharge-chat] reintento de acreditación falló", error);
  }
}

// --- Helpers ----------------------------------------------------------------

function reply(
  state: RechargeChatState,
  texts: string[],
  intent?: { id: string; status: string } | null,
): RechargeChatResult {
  return {
    handled: true,
    state,
    replies: texts.map((text) => ({ id: randomUUID(), text })),
    ...(intent !== undefined ? { intent } : {}),
  };
}

function notHandled(): RechargeChatResult {
  return { handled: false, state: "idle", replies: [] };
}
