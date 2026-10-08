/**
 * «Mis recargas»: en qué quedó cada recarga del cliente y qué le falta hacer.
 * Sin dependencias de servidor para poder probarlo.
 */
export type RechargeState =
  | "credited"
  | "in_review"
  | "needs_proof"
  | "pay_yape"
  | "pay_crypto"
  | "processing"
  | "replaced"
  | "cancelled"
  | "failed";

export type RechargeRow = {
  id: string;
  createdAt: string;
  state: RechargeState;
  provider: string;
  /** Lo que el cliente paga (con fee), en la moneda del cobro. */
  chargeCents: number;
  chargeCurrency: "USD" | "PEN";
  /** Lo que entra a la cartera, en USD. */
  creditUsdCents: number | null;
  yapeCode: string | null;
  checkoutUrl: string | null;
  note: string | null;
  /** USDT que faltó enviar cuando NOWPayments marcó el pago como parcial. */
  cryptoMissingUsdt: number | null;
};

type IntentLike = {
  id: string;
  created_at: string;
  status: string;
  provider: string;
  amount_cents: number | string;
  currency: string | null;
  checkout_url?: string | null;
  failure_reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export function rechargeState(intent: IntentLike): RechargeState {
  const m = intent.metadata ?? {};
  const open = ["created", "requires_payment", "processing"].includes(intent.status);
  if (intent.status === "succeeded") return "credited";
  if (intent.status === "failed") return "failed";
  if (intent.status === "cancelled") {
    return m.cobrana_cancelled_reason === "superseded" ? "replaced" : "cancelled";
  }
  if (!open) return "processing";
  if (intent.provider === "cobrana") return "pay_yape";
  const voucherFlow =
    intent.provider === "manual" || (intent.provider === "crypto" && m.crypto_mode !== "nowpayments");
  if (voucherFlow) {
    return m.manual_proof || m.manual_review_status === "pending_review" ? "in_review" : "needs_proof";
  }
  if (intent.provider === "crypto") return "pay_crypto";
  return "processing";
}

/**
 * Cuánto USDT le faltó al cliente, redondeado hacia arriba a 2 decimales para
 * que lo que mande alcance. Solo si la recarga sigue abierta.
 */
export function cryptoMissingUsdt(intent: IntentLike): number | null {
  const m = intent.metadata ?? {};
  if (intent.provider !== "crypto" || m.crypto_awaiting_remaining !== true) return null;
  if (rechargeState(intent) !== "pay_crypto") return null;
  const asked = num(m.crypto_pay_amount);
  const paid = num(m.crypto_actually_paid);
  if (asked == null || paid == null || paid >= asked) return null;
  return Math.ceil(Math.round((asked - paid) * 1e6) / 1e4) / 100;
}

export function toRechargeRow(intent: IntentLike): RechargeRow {
  const m = intent.metadata ?? {};
  const currency = String(m.charge_currency ?? intent.currency ?? "USD").toUpperCase() === "PEN" ? "PEN" : "USD";
  return {
    id: intent.id,
    createdAt: intent.created_at,
    state: rechargeState(intent),
    provider: intent.provider,
    chargeCents: num(intent.amount_cents) ?? 0,
    chargeCurrency: currency,
    creditUsdCents: num(m.credit_amount_cents),
    yapeCode: typeof m.cobrana_code === "string" && m.cobrana_code.trim() ? m.cobrana_code.trim() : null,
    checkoutUrl: typeof intent.checkout_url === "string" && /^https:\/\//.test(intent.checkout_url) ? intent.checkout_url : null,
    note: intent.status === "failed" && intent.failure_reason ? String(intent.failure_reason).slice(0, 200) : null,
    cryptoMissingUsdt: cryptoMissingUsdt(intent),
  };
}

/** Primero lo que necesita acción del cliente, después lo demás por fecha. */
export function sortRecharges(rows: RechargeRow[]): RechargeRow[] {
  const needsAction = (s: RechargeState) => (s === "needs_proof" || s === "pay_yape" || s === "pay_crypto" ? 0 : 1);
  return [...rows].sort((a, b) => {
    const d = needsAction(a.state) - needsAction(b.state);
    return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt);
  });
}
