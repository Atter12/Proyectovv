/** Utilidades compartidas cliente/servidor para pago manual PEN. */

export function formatPenAmount(penCents: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(penCents / 100);
}

/**
 * Inverso del quote: a partir del monto real transferido (bruto),
 * recalcula crédito USD y fee.
 */
export function quoteFromGrossCharge(input: {
  grossChargeCents: number;
  chargeCurrency: "USD" | "PEN";
  feePercent: number;
  fxRateUsdPen: number;
}): {
  grossChargeCents: number;
  chargeCurrency: "USD" | "PEN";
  feePercent: number;
  fxRateUsdPen: number;
  creditUsdCents: number;
  feeUsdCents: number;
  grossUsdCents: number;
  creditPenCents: number | null;
  feePenCents: number | null;
  grossPenCents: number | null;
} {
  const feePercent = Math.max(0, Number(input.feePercent) || 0);
  const rate =
    Number.isFinite(input.fxRateUsdPen) && input.fxRateUsdPen > 0
      ? input.fxRateUsdPen
      : 3.48;
  const grossChargeCents = Math.max(0, Math.round(input.grossChargeCents));

  if (input.chargeCurrency === "USD") {
    const grossUsdCents = grossChargeCents;
    const creditUsdCents = Math.round(grossUsdCents / (1 + feePercent / 100));
    const feeUsdCents = Math.max(0, grossUsdCents - creditUsdCents);
    return {
      grossChargeCents,
      chargeCurrency: "USD",
      feePercent,
      fxRateUsdPen: rate,
      creditUsdCents,
      feeUsdCents,
      grossUsdCents,
      creditPenCents: Math.round((creditUsdCents / 100) * rate * 100),
      feePenCents: null,
      grossPenCents: Math.round((grossUsdCents / 100) * rate * 100),
    };
  }

  const grossPenCents = grossChargeCents;
  const creditPenCents = Math.round(grossPenCents / (1 + feePercent / 100));
  const feePenCents = Math.max(0, grossPenCents - creditPenCents);
  const creditUsdCents = Math.round((creditPenCents / 100 / rate) * 100);
  const grossUsdCents = Math.round((grossPenCents / 100 / rate) * 100);
  const feeUsdCents = Math.max(0, grossUsdCents - creditUsdCents);

  return {
    grossChargeCents,
    chargeCurrency: "PEN",
    feePercent,
    fxRateUsdPen: rate,
    creditUsdCents,
    feeUsdCents,
    grossUsdCents,
    creditPenCents,
    feePenCents,
    grossPenCents,
  };
}
