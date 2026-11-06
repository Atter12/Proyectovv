import assert from "node:assert/strict";
import test from "node:test";
import { reconcileNowPayments, type CryptoPaymentSnapshot } from "./nowpayments-reconciliation.ts";

const intent = { id: "steve", providerReference: "5000861814", amountCents: 6600, currency: "USD" };
const base: CryptoPaymentSnapshot = { order_id: intent.id, invoice_id: intent.providerReference!,
  payment_id: "4600956943", pay_currency: "usdttrc20", price_amount: 66,
  price_currency: "usd", pay_amount: 65.941421, actually_paid: 0, payment_status: "waiting" };
const first = { ...base, payment_status: "partially_paid", actually_paid: 56 };
const second = { ...base, payment_id: "5323306333", pay_amount: 65.907723, payment_status: "partially_paid", actually_paid: 10 };

test("Steve: 56 + 10 settles the invoice, not a new 55.91 USDT shortfall", () => {
  const partial = reconcileNowPayments([base, first], intent);
  assert.equal(partial.actuallyPaid, 56);
  assert.equal(partial.canCredit, false);
  assert.equal(partial.shortfall, 9.941421);
  const completed = reconcileNowPayments([base, first, second], intent);
  assert.equal(completed.actuallyPaid, 66);
  assert.equal(completed.payAmount, 65.941421);
  assert.equal(completed.canCredit, true);
  assert.deepEqual(completed.paymentIds, ["4600956943", "5323306333"]);
});

test("duplicate and out-of-order IPNs do not double count or erase payments", () => {
  const paid = reconcileNowPayments([base, second, first, first, second,
    { ...first, payment_status: "finished" }, { ...base, payment_status: "waiting" }], intent);
  assert.equal(paid.actuallyPaid, 66);
  assert.equal(paid.canCredit, true);
});

test("one payment's cumulative updates are counted once, not added", () => {
  const paid = reconcileNowPayments([base, first, { ...first, actually_paid: 66 }, first], intent);
  assert.equal(paid.actuallyPaid, 66);
  assert.equal(paid.paymentIds.length, 1);
});

test("confirmed/sending money cannot complete a partial payment yet", () => {
  for (const status of ["waiting", "confirmed", "sending"]) {
    const paid = reconcileNowPayments([base, first, { ...second, payment_status: status }], intent);
    assert.equal(paid.actuallyPaid, 56);
    assert.equal(paid.canCredit, false);
  }
});

test("other orders and invoices do not contribute", () => {
  const paid = reconcileNowPayments([base, first, { ...second, order_id: "other" },
    { ...second, invoice_id: "other" }], intent);
  assert.equal(paid.actuallyPaid, 56);
  assert.equal(paid.canCredit, false);
});

test("mixed assets, linked parents, missing IDs and mismatched prices require review", () => {
  for (const patch of [{ pay_currency: "btc" }, { parent_payment_id: first.payment_id },
    { payment_id: undefined }, { price_amount: 660 }, { price_currency: "eur" }, { actually_paid: "NaN" }]) {
    const paid = reconcileNowPayments([base, first, { ...second, ...patch }], intent);
    assert.equal(paid.needsReview, true, JSON.stringify(patch));
    assert.equal(paid.canCredit, false);
  }
});

test("a refund is excluded even when a stale finished event arrives later", () => {
  const paid = reconcileNowPayments([base, first, second,
    { ...second, payment_status: "refunded" }, second], intent);
  assert.equal(paid.actuallyPaid, 56);
  assert.equal(paid.canCredit, false);
});

test("existing 2 USDT tolerance remains, but never absorbs 2 BTC", () => {
  assert.equal(reconcileNowPayments([base, { ...first, actually_paid: 65 }], intent).absorbed, true);
  const btc = [base, { ...first, actually_paid: 0.0001 }].map((p) => ({ ...p, pay_currency: "btc", pay_amount: 0.001 }));
  assert.equal(reconcileNowPayments(btc, intent).canCredit, false);
});
