import "server-only";
import { depositFromDesiredCredit } from "@/lib/payments/deposit-fee";
import { serverEnv } from "@/lib/env/env.server";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";

export type ManualChargeCurrency = "USD" | "PEN";

export type ManualDepositQuote = {
  creditUsdCents: number;
  creditPenCents: number | null;
  feePercent: number;
  feeUsdCents: number;
  feePenCents: number | null;
  grossUsdCents: number;
  grossPenCents: number | null;
  chargeCurrency: ManualChargeCurrency;
  /** Monto exacto a transferir (centavos en moneda de cobro). */
  grossChargeCents: number;
  fxRateUsdPen: number;
};

export function getHolisticUsdPenRate(): number {
  const raw = serverEnv.holisticUsdPenRate;
  if (!Number.isFinite(raw) || raw <= 0) return 3.48;
  return Math.round(raw * 10000) / 10000;
}

/**
 * Cliente elige crédito en cartera (USD). Fee sobre neto en moneda de cobro.
 */
export function buildManualDepositQuote(input: {
  creditUsd: number;
  feePercent: number;
  chargeCurrency: ManualChargeCurrency;
  usdPenRate?: number;
}): ManualDepositQuote {
  const rate = input.usdPenRate ?? getHolisticUsdPenRate();
  const creditUsdCents = Math.round(input.creditUsd * 100);
  const usdSplit = depositFromDesiredCredit(creditUsdCents, input.feePercent);

  if (input.chargeCurrency === "USD") {
    return {
      creditUsdCents,
      creditPenCents: Math.round((creditUsdCents / 100) * rate * 100),
      feePercent: input.feePercent,
      feeUsdCents: usdSplit.feeCents,
      feePenCents: null,
      grossUsdCents: usdSplit.grossCents,
      grossPenCents: Math.round((usdSplit.grossCents / 100) * rate * 100),
      chargeCurrency: "USD",
      grossChargeCents: usdSplit.grossCents,
      fxRateUsdPen: rate,
    };
  }

  const creditPenCents = Math.round((creditUsdCents / 100) * rate * 100);
  const grossPenCents = Math.round(creditPenCents * (1 + input.feePercent / 100));
  const feePenCents = Math.max(0, grossPenCents - creditPenCents);

  return {
    creditUsdCents,
    creditPenCents,
    feePercent: input.feePercent,
    feeUsdCents: usdSplit.feeCents,
    feePenCents,
    grossUsdCents: usdSplit.grossCents,
    grossPenCents,
    chargeCurrency: "PEN",
    grossChargeCents: grossPenCents,
    fxRateUsdPen: rate,
  };
}

export { formatPenAmount };