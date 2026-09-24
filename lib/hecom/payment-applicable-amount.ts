/**
 * Monto de un cobro Hecom que sí baja deuda (HmCreditoDeudaCore.paymentApplicableAmount).
 * El surcharge de pasarela (ej. Stripe 3%) NO cubre gasto+fee; el fee Holistic sí.
 */
export type HecomFundingBreakdown = {
  schema_version?: unknown;
  currency?: unknown;
  mode?: unknown;
  payment_intent_id?: unknown;
  hecom_client_id?: unknown;
  provider?: unknown;
  source?: unknown;
  ledger_journal_id?: unknown;
  gross_cents?: unknown;
  wallet_credit_cents?: unknown;
  holistic_fee_cents?: unknown;
  gateway_surcharge_cents?: unknown;
  unclassified_cents?: unknown;
  fee_holistic_percent?: unknown;
  fee_gateway_percent?: unknown;
};

export type HecomCobroForDebt = {
  monto?: number | null;
  codigo?: string | null;
  client_id?: string | null;
  clientId?: string | null;
  funding_breakdown?: HecomFundingBreakdown | null;
  fundingBreakdown?: HecomFundingBreakdown | null;
};

function safeId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 200 &&
    id.trim() === id &&
    !["__proto__", "constructor", "prototype"].includes(id.toLowerCase())
  );
}

function money(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
}

/**
 * Paridad con Hecom Club `hm-credito-deuda-core.js` → paymentApplicableAmount.
 * Si el cobro AH-* trae funding_breakdown válido con gateway surcharge, ese
 * surcharge no imputa a la deuda (Total − aplicable).
 */
export function paymentApplicableAmount(row: HecomCobroForDebt): number {
  const amount = Number(row?.monto || 0);
  const value = (row?.funding_breakdown ?? row?.fundingBreakdown) || null;
  const gross = Math.round(amount * 100);
  const clientId = String(row?.client_id ?? row?.clientId ?? "");
  const match = /^AH-(STRIPE|BCP|YAPE|CRYPTO)-(.+)$/.exec(
    String(row?.codigo || ""),
  );
  const providers: Record<string, string> = {
    STRIPE: "stripe",
    BCP: "manual",
    YAPE: "cobrana",
    CRYPTO: "crypto",
  };

  if (!Number.isFinite(amount) || !money(gross) || !match || !value || typeof value !== "object" || Array.isArray(value)) {
    return amount;
  }

  if (
    value.schema_version !== 1 ||
    value.currency !== "USD" ||
    !["wallet_topup", "credit_debt", "unknown"].includes(String(value.mode))
  ) {
    return amount;
  }

  if (
    !safeId(value.payment_intent_id) ||
    !safeId(value.hecom_client_id) ||
    value.payment_intent_id !== match[2] ||
    value.provider !== providers[match[1]] ||
    String(value.hecom_client_id).toLowerCase() !== clientId.toLowerCase()
  ) {
    return amount;
  }

  if (
    (value.source !== null && value.source !== undefined && !safeId(value.source)) ||
    (value.ledger_journal_id !== null &&
      value.ledger_journal_id !== undefined &&
      !safeId(value.ledger_journal_id))
  ) {
    return amount;
  }

  const keys = [
    "wallet_credit_cents",
    "holistic_fee_cents",
    "gateway_surcharge_cents",
    "unclassified_cents",
  ] as const;

  if (
    !money(value.gross_cents) ||
    value.gross_cents === 0 ||
    value.gross_cents !== gross ||
    keys.some((key) => !money(value[key]))
  ) {
    return amount;
  }

  const partsSum = keys.reduce(
    (sum, key) => sum + BigInt(value[key] as number),
    BigInt(0),
  );
  if (partsSum !== BigInt(gross)) return amount;

  if (
    value.mode !== "wallet_topup" &&
    (value.wallet_credit_cents !== 0 || value.holistic_fee_cents !== 0)
  ) {
    return amount;
  }

  if (
    value.mode === "unknown" &&
    (value.gateway_surcharge_cents !== 0 || value.unclassified_cents !== gross)
  ) {
    return amount;
  }

  for (const key of ["fee_holistic_percent", "fee_gateway_percent"] as const) {
    const rate = value[key];
    if (
      rate !== null &&
      rate !== undefined &&
      (typeof rate !== "number" ||
        !Number.isFinite(rate) ||
        rate < 0 ||
        rate > 1000)
    ) {
      return amount;
    }
  }

  const surcharge = value.gateway_surcharge_cents as number;
  return surcharge > 0 ? (gross - surcharge) / 100 : amount;
}

export function gatewaySurchargeUsd(row: HecomCobroForDebt): number {
  const full = Number(row?.monto || 0);
  const applicable = paymentApplicableAmount(row);
  const diff = Math.round((full - applicable) * 100) / 100;
  return diff > 0.004 ? diff : 0;
}
