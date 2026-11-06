/** Reconcile verified IPNs, never add repeated notifications for one payment. */
export interface CryptoPaymentSnapshot {
  order_id?: string;
  invoice_id?: string | number;
  payment_id?: string | number;
  parent_payment_id?: string | number | null;
  payment_status?: string;
  pay_currency?: string;
  pay_amount?: number | string;
  actually_paid?: number | string;
  price_amount?: number | string;
  price_currency?: string;
}

export function reconcileNowPayments(
  snapshots: CryptoPaymentSnapshot[],
  intent: { id: string; providerReference: string | null; amountCents: number; currency: string },
) {
  const relevant = snapshots.filter((p) => p.order_id === intent.id &&
    intent.providerReference != null && String(p.invoice_id) === intent.providerReference);
  const settled = relevant.filter((p) => ["partially_paid", "finished"].includes(p.payment_status ?? ""));
  const currencies = new Set(settled.map((p) => p.pay_currency?.toLowerCase()));
  const currency = currencies.size === 1 ? [...currencies][0] : undefined;
  // A linked child may report its parent's cumulative amount. Do not add it blindly.
  const needsReview = settled.some((p) => !p.payment_id || p.parent_payment_id != null ||
    !Number.isFinite(Number(p.actually_paid)) || Number(p.actually_paid) < 0 ||
    !Number.isFinite(Number(p.price_amount)) ||
    Math.round(Number(p.price_amount) * 100) !== intent.amountCents ||
    p.price_currency?.toUpperCase() !== intent.currency.toUpperCase()) ||
    (settled.length > 0 && (!currency || currencies.size !== 1));
  const reversed = new Set(relevant.filter((p) => ["refunded", "failed"].includes(p.payment_status ?? ""))
    .map((p) => String(p.payment_id)));
  const payments = new Map<string, number>();
  for (const p of settled) {
    if (reversed.has(String(p.payment_id))) continue;
    const amount = Number(p.actually_paid);
    if (Number.isFinite(amount) && amount >= 0) {
      payments.set(String(p.payment_id), Math.max(payments.get(String(p.payment_id)) ?? 0, amount));
    }
  }
  const actuallyPaid = Math.round([...payments.values()].reduce((sum, amount) => sum + amount, 0) * 1e8) / 1e8;
  // Input is ordered by receipt time. Keep the first quote in the same asset/network.
  const quoted = relevant.find((p) => p.payment_status === "waiting" &&
    p.pay_currency?.toLowerCase() === currency && Number(p.pay_amount) > 0) ??
    settled.find((p) => p.pay_currency?.toLowerCase() === currency && Number(p.pay_amount) > 0);
  const payAmount = quoted ? Number(quoted.pay_amount) : null;
  const shortfall = payAmount != null ? Math.round((payAmount - actuallyPaid) * 1e8) / 1e8 : null;
  const isUsdt = /^usdt(?:[a-z0-9]*)$/.test(currency ?? "");
  // Existing management policy: absorb up to 2 USDT, never 2 units of another asset.
  const absorbed = !needsReview && isUsdt && actuallyPaid > 0 && shortfall != null && shortfall > 0.01 && shortfall <= 2;
  const covered = !needsReview && actuallyPaid > 0 && shortfall != null && shortfall <= (isUsdt ? 0.01 : 1e-8);
  return { actuallyPaid, payAmount, shortfall, currency: currency ?? null,
    paymentIds: [...payments.keys()].sort(), needsReview, absorbed,
    canCredit: covered || absorbed, hasSettled: payments.size > 0 };
}
