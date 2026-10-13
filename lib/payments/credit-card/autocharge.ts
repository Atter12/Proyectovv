/**
 * Anti-vivos: el cliente con crédito Holistic deja su tarjeta en Whop y cada
 * lunes se le cobra la deuda. Si la tarjeta rechaza, no puede fondear más a
 * crédito y tiene 48 h para pagar; si no paga, se congela.
 * Sin dependencias de servidor para poder probarlo.
 */

/** Día de cobro: lunes, hora de Lima. */
export const AUTOCHARGE_WEEKDAY = 1;
/** Horas para pagar después de un rechazo antes de congelar. */
export const AUTOCHARGE_GRACE_HOURS = 48;
/** Debajo de esto no se cobra (Whop cobra $0.30 fijo por cobro). */
export const AUTOCHARGE_MIN_CENTS = 500;
/** Un cobro sin respuesta de Whop por más de esto se da por perdido. */
export const AUTOCHARGE_PENDING_MAX_HOURS = 24;

const LIMA_OFFSET_HOURS = -5;

export const AUTOCHARGE_CONSENT_TEXT =
  "Autorizo a Holistic Marketing a cobrar a esta tarjeta, cada lunes, lo que gasté a crédito y no pagué " +
  "(más el recargo de la pasarela). Si el cobro es rechazado y no pago en 48 horas, mis cuentas se congelan " +
  "hasta que pague.";

export type AutochargeMode = "off" | "dry_run" | "live";

export function resolveAutochargeMode(raw: string | undefined): AutochargeMode {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "live" || v === "dry_run" ? v : "off";
}

/** Lunes en Lima (UTC−5, sin horario de verano). */
export function isAutochargeDay(now: Date): boolean {
  const lima = new Date(now.getTime() + LIMA_OFFSET_HOURS * 3_600_000);
  return lima.getUTCDay() === AUTOCHARGE_WEEKDAY;
}

/** Fecha de Lima (YYYY-MM-DD): un cobro por cliente por día. */
export function limaDateKey(now: Date): string {
  return new Date(now.getTime() + LIMA_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

/** Deuda + recargo de la pasarela, igual que una recarga con Whop. */
export function autochargeAmounts(debtCents: number, surchargePercent: number): {
  grossCents: number;
  surchargeCents: number;
} {
  const pct = Number.isFinite(surchargePercent) && surchargePercent > 0 ? surchargePercent : 0;
  const surchargeCents = Math.round((debtCents * pct) / 100);
  return { grossCents: debtCents + surchargeCents, surchargeCents };
}

export type AutochargeAction =
  /** Al día y sin nada pendiente. */
  | "none"
  /** Pagó: se limpian el rechazo y el congelado que puso el sistema. */
  | "clear"
  /** Hay un cobro esperando respuesta de Whop. */
  | "wait_pending"
  | "charge"
  /** Pasaron las 48 h sin pagar después de un rechazo. */
  | "freeze";

export type AutochargeDecisionInput = {
  now: Date;
  debtCents: number;
  /** Cupo aprobado (USD cents). */
  cupoCents: number | null;
  softCapPercent: number;
  failedSince: Date | null;
  frozenAt: Date | null;
  pendingCharge: boolean;
  /** Ya se intentó cobrar hoy (hora de Lima). */
  chargedToday: boolean;
};

export function decideAutocharge(input: AutochargeDecisionInput): {
  action: AutochargeAction;
  reason: string;
} {
  if (input.debtCents < AUTOCHARGE_MIN_CENTS) {
    return input.failedSince || input.frozenAt
      ? { action: "clear", reason: "deuda_pagada" }
      : { action: "none", reason: "sin_deuda" };
  }
  if (input.pendingCharge) return { action: "wait_pending", reason: "cobro_en_proceso" };

  if (input.failedSince && !input.frozenAt) {
    const hours = (input.now.getTime() - input.failedSince.getTime()) / 3_600_000;
    if (hours >= AUTOCHARGE_GRACE_HOURS) return { action: "freeze", reason: "rechazo_sin_pago_48h" };
  }
  if (input.chargedToday) return { action: "none", reason: "ya_cobrado_hoy" };
  // Después de un rechazo se reintenta cada día hasta que pague.
  if (input.failedSince) return { action: "charge", reason: "reintento" };
  if (isAutochargeDay(input.now)) return { action: "charge", reason: "lunes" };
  if (input.cupoCents != null && input.cupoCents > 0) {
    const capCents = Math.floor((input.cupoCents * input.softCapPercent) / 100);
    if (input.debtCents >= capCents) return { action: "charge", reason: "tope_cupo" };
  }
  return { action: "none", reason: "esperar_lunes" };
}

/** Checkout de Whop en modo «setup»: guarda la tarjeta sin cobrar. */
export function buildWhopCardSetupBody(input: {
  companyId: string;
  redirectUrl: string;
  metadata: Record<string, string>;
}): Record<string, unknown> {
  return {
    account_id: input.companyId,
    mode: "setup",
    currency: "usd",
    redirect_url: input.redirectUrl,
    // Solo tarjeta: es lo único que Whop puede cobrar sin el cliente presente.
    payment_method_configuration: {
      enabled: ["card"],
      disabled: [],
      include_platform_defaults: false,
    },
    metadata: input.metadata,
  };
}

export const WHOP_CREDIT_PRODUCT_EXTERNAL_ID = "adsholistic-credito-cobro";

/** Cobro a la tarjeta guardada, sin el cliente presente. */
export function buildWhopOffSessionPaymentBody(input: {
  companyId: string;
  memberId: string;
  paymentMethodId: string;
  amountCents: number;
  productId?: string;
  metadata: Record<string, string>;
}): Record<string, unknown> {
  const plan: Record<string, unknown> = {
    currency: "usd",
    plan_type: "one_time",
    initial_price: Math.round(input.amountCents) / 100,
    title: "Cobro crédito Holistic",
    visibility: "hidden",
  };
  if (input.productId) {
    plan.product_id = input.productId;
  } else {
    plan.product = {
      external_identifier: WHOP_CREDIT_PRODUCT_EXTERNAL_ID,
      title: "Crédito Holistic",
      description: "Cobro semanal del crédito Ads Holistic",
      visibility: "hidden",
    };
  }
  return {
    account_id: input.companyId,
    member_id: input.memberId,
    payment_method_id: input.paymentMethodId,
    plan,
    metadata: input.metadata,
  };
}
