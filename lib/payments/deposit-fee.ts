/**
 * Fee Holistic en depósitos (modelo Hecom Club).
 *
 * UX: el cliente indica cuánto quiere en cartera (neto).
 * Ejemplo fee 10%: quiere $100 → se cobra $110 → acredita $100
 *   gross = credit * (1 + fee/100)
 */

export type DepositFeeBreakdown = {
  /** Monto cobrado al cliente (Stripe / pasarela). */
  grossCents: number;
  /** Monto que llega a la cartera Holistic. */
  creditCents: number;
  feeCents: number;
  feePercent: number;
};

/** Fallback si Hecom no tiene fee en cliente ni en cuentas. */
export const DEFAULT_DEPOSIT_FEE_PERCENT = 10;

/**
 * Normaliza el % Hecom.
 * Acepta 10 o "10"; si viniera 0.1 (fracción), lo convierte a 10.
 */
export function normalizeFeePercent(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw < 0) return null;
  if (raw > 0 && raw < 1) {
    return Math.round(raw * 10000) / 100;
  }
  return Math.round(raw * 100) / 100;
}

/**
 * A partir del neto deseado en cartera, calcula cuánto cobrar (bruto + fee).
 */
export function depositFromDesiredCredit(
  creditCents: number,
  feePercent: number,
): DepositFeeBreakdown {
  const credit = Math.max(0, Math.round(creditCents));
  const pct = Math.max(0, feePercent);

  if (credit <= 0) {
    return { grossCents: 0, creditCents: 0, feeCents: 0, feePercent: pct };
  }

  if (pct <= 0) {
    return {
      grossCents: credit,
      creditCents: credit,
      feeCents: 0,
      feePercent: 0,
    };
  }

  const grossCents = Math.round(credit * (1 + pct / 100));
  const feeCents = Math.max(0, grossCents - credit);

  return {
    grossCents,
    creditCents: credit,
    feeCents,
    feePercent: pct,
  };
}

/**
 * @deprecated Preferí depositFromDesiredCredit (UX: cliente elige neto).
 * Conservado por si llega un bruto conocido (reconciliación).
 */
export function splitDepositByFeePercent(
  grossCents: number,
  feePercent: number,
): DepositFeeBreakdown {
  const gross = Math.max(0, Math.round(grossCents));
  const pct = Math.max(0, feePercent);

  if (gross <= 0) {
    return { grossCents: 0, creditCents: 0, feeCents: 0, feePercent: pct };
  }

  if (pct <= 0) {
    return {
      grossCents: gross,
      creditCents: gross,
      feeCents: 0,
      feePercent: 0,
    };
  }

  const creditCents = Math.round(gross / (1 + pct / 100));
  const feeCents = Math.max(0, gross - creditCents);

  return {
    grossCents: gross,
    creditCents,
    feeCents,
    feePercent: pct,
  };
}

export function formatFeePercentLabel(feePercent: number): string {
  const rounded = Math.round(feePercent * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded}%`;
}
