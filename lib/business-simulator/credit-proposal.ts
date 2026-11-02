export type CreditTerms = { principalCents: number; feeBps: number; days: number; currency: "USD" | "PEN" };
export function creditRepayment(input: CreditTerms) {
  if (!Number.isSafeInteger(input.principalCents) || input.principalCents <= 0 || input.principalCents > 100_000_000_000 || !Number.isSafeInteger(input.feeBps) || input.feeBps < 0 || input.feeBps > 10000 || !Number.isSafeInteger(input.days) || input.days < 1 || input.days > 3650 || !["USD", "PEN"].includes(input.currency)) throw new Error("Revisa el monto, FEE y plazo del crédito.");
  const feeCents = Number((BigInt(input.principalCents) * BigInt(input.feeBps) + BigInt(5000)) / BigInt(10000));
  return { ...input, feeCents, totalDueCents: input.principalCents + feeCents };
}
export type FundingHistory = { count: number; totalCreditedUsdCents: number; typicalCreditUsdCents: number | null; averageGapDays: number | null; lastPaymentAt: string | null };
export type CreditAssessment = {
  clientId: string; checkedAt: string; terms: CreditTerms; totalDueCents: number; feeCents: number;
  headline: string; signals: { label: string; value: string; tone: "positive" | "attention" | "neutral" }[];
  pending: string[]; sources: string[]; aiSummary: string | null; aiNotice: string | null;
};
