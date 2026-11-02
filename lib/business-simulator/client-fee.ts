export type FeePayment = { id: string; organization_id: string; amount_cents: number; currency: string; provider: string; status: string; succeeded_at: string | null; metadata: Record<string, unknown> | null };
export type FeeJournal = { source_id: string; organization_id: string; amount_cents: number; currency: string; status: string };
const numeric = (v: unknown) => v === null || v === undefined || v === "" || typeof v === "boolean" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
export const validFee = (v: unknown) => { const n = numeric(v); return n !== null && n >= 0 && n <= 100 ? n : null; };
export function paymentFeeEvidence(payment: FeePayment, journals: FeeJournal[]) {
  const m = payment.metadata ?? {};
  if (payment.status !== "succeeded" || !payment.succeeded_at || m.skip_wallet_credit === true || ["lo_pagado_deuda", "hecom_missing_cobro"].includes(String(m.purpose))) return null;
  const matched = journals.filter(j => j.source_id === payment.id && j.organization_id === payment.organization_id && j.status === "posted" && j.currency === "USD");
  if (matched.length !== 1) return null;
  const credit = matched[0].amount_cents;
  if (!Number.isSafeInteger(credit) || credit <= 0) return null;
  const expectedCredit = numeric(m.credit_amount_cents);
  if (expectedCredit !== null && expectedCredit !== credit) return null;
  const charge = payment.amount_cents;
  if (!Number.isSafeInteger(charge) || charge <= 0) return null;
  const fx = numeric(m.fx_rate_usd_pen);
  const gross = payment.currency === "USD" ? charge : payment.currency === "PEN" && fx !== null && fx > 0 ? Math.round(charge / fx) : null;
  if (gross === null || gross < credit) return null;
  // Card/crypto differences may include gateway fees. Never attribute an unknown charge to Holistic.
  const surcharge = payment.provider === "manual" ? 0 : validFee(m.fee_stripe_surcharge_percent);
  if (surcharge === null || (payment.provider !== "manual" && !["stripe", "whop"].includes(payment.provider))) return null;
  const totalPercent = (gross / credit - 1) * 100;
  const derived = Math.round((totalPercent - surcharge) * 100) / 100;
  if (derived < 0 || derived > 100) return null;
  const recorded = validFee(m.fee_holistic_percent) ?? (payment.provider === "manual" ? validFee(m.fee_percent) : null);
  const toleranceCents = payment.currency === "PEN" ? Math.ceil(1 / fx!) + 2 : 2;
  const consistent = recorded !== null && Math.abs(Math.round(credit * (1 + (recorded + surcharge) / 100)) - gross) <= toleranceCents;
  return { paymentId: payment.id, date: payment.succeeded_at, feePercent: consistent ? recorded : derived, source: consistent ? "payment_record" : "payment_derived", paidCents: charge, paidCurrency: payment.currency, creditUsdCents: credit, grossUsdCents: gross, fxRate: payment.currency === "PEN" ? fx : null, surchargePercent: surcharge };
}
export function resolveClientFee(clientFee: unknown, accountFees: unknown[], evidence: ReturnType<typeof paymentFeeEvidence>[]) {
  const history = evidence.filter((e): e is NonNullable<typeof e> => e !== null).sort((a,b) => b.date.localeCompare(a.date));
  const configured = validFee(clientFee);
  const accounts = [...new Set(accountFees.map(validFee).filter((v): v is number => v !== null))];
  const latest = history[0] ?? null;
  const feeHolisticPercent = configured ?? (accounts.length === 1 ? accounts[0] : accounts.length === 0 ? latest?.feePercent ?? null : null);
  const feeSource = configured !== null ? "hecom_cliente" : accounts.length === 1 ? "hecom_account" : accounts.length > 1 ? "mixed_accounts" : latest?.source ?? "unknown";
  const warnings: string[] = [];
  if (accounts.length > 1) warnings.push("Hay acuerdos distintos por cuenta publicitaria. Revisa qué cuenta estás evaluando.");
  if (latest && feeHolisticPercent !== null && Math.abs(latest.feePercent - feeHolisticPercent) > 0.05) warnings.push(`La última recarga aplicó ${latest.feePercent}%; el acuerdo configurado indica ${feeHolisticPercent}%.`);
  if (new Set(history.map(h=>h.feePercent)).size > 1) warnings.push("Las recargas recientes tienen porcentajes distintos; no se promediaron.");
  if (feeSource.startsWith("payment_")) warnings.push("Referencia de la última recarga verificable; no confirma un acuerdo vigente.");
  if (feeHolisticPercent === null && accounts.length < 2) warnings.push("No hay un acuerdo ni una recarga verificable para detectar el FEE. No se asignó el 10% por defecto.");
  return { feeHolisticPercent, feeSource, history: history.slice(0,5), verifiedPayments: history.length, warnings };
}

/** Recharges are funding activity, never proof of on-time debt repayments. */
export function summarizeFunding(payments: FeePayment[], journals: FeeJournal[]) {
  const unique = new Set<string>();
  const matched = payments.flatMap(p => {
    const m = p.metadata ?? {};
    if (unique.has(p.id) || p.status !== "succeeded" || !p.succeeded_at || !Number.isFinite(Date.parse(p.succeeded_at)) || m.skip_wallet_credit === true || ["lo_pagado_deuda", "hecom_missing_cobro"].includes(String(m.purpose))) return [];
    unique.add(p.id);
    const rows = journals.filter(j=>j.source_id === p.id && j.organization_id === p.organization_id && j.currency === "USD" && j.status === "posted");
    if (rows.length !== 1 || !Number.isSafeInteger(rows[0].amount_cents) || rows[0].amount_cents <= 0) return [];
    return [{ amount: rows[0].amount_cents, date: p.succeeded_at }];
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const sortedAmounts = matched.map(p=>p.amount).sort((a,b)=>a-b);
  const n = matched.length;
  return { count: n, totalCreditedUsdCents: matched.reduce((sum,p)=>sum+p.amount,0), typicalCreditUsdCents: n ? n % 2 ? sortedAmounts[Math.floor(n/2)] : Math.round((sortedAmounts[n/2-1]+sortedAmounts[n/2])/2) : null, averageGapDays: n > 1 ? Math.round((Date.parse(matched[n-1].date)-Date.parse(matched[0].date))/86400000/(n-1)*10)/10 : null, lastPaymentAt: matched.at(-1)?.date ?? null };
}
