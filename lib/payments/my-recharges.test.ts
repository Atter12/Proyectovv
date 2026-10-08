import assert from "node:assert/strict";
import test from "node:test";
import { cryptoMissingUsdt, rechargeState, sortRecharges, toRechargeRow } from "./my-recharges.shared.ts";

const base = { id: "a", created_at: "2026-10-06T15:00:00Z", amount_cents: 11000, currency: "USD" };

test("pago manual sin comprobante pide subirlo; con comprobante queda en revisión", () => {
  assert.equal(rechargeState({ ...base, status: "requires_payment", provider: "manual", metadata: {} }), "needs_proof");
  assert.equal(
    rechargeState({ ...base, status: "requires_payment", provider: "manual", metadata: { manual_proof: { path: "x" } } }),
    "in_review",
  );
});

test("Yape pendiente pide pagar; reemplazado por uno nuevo no se confunde con cancelado", () => {
  assert.equal(rechargeState({ ...base, status: "requires_payment", provider: "cobrana", metadata: {} }), "pay_yape");
  assert.equal(
    rechargeState({ ...base, status: "cancelled", provider: "cobrana", metadata: { cobrana_cancelled_reason: "superseded" } }),
    "replaced",
  );
  assert.equal(rechargeState({ ...base, status: "cancelled", provider: "stripe", metadata: {} }), "cancelled");
});

test("cripto con NOWPayments espera pago; acreditada y rechazada salen tal cual", () => {
  assert.equal(
    rechargeState({ ...base, status: "requires_payment", provider: "crypto", metadata: { crypto_mode: "nowpayments" } }),
    "pay_crypto",
  );
  assert.equal(rechargeState({ ...base, status: "succeeded", provider: "manual", metadata: {} }), "credited");
  assert.equal(rechargeState({ ...base, status: "failed", provider: "manual", metadata: {} }), "failed");
});

test("la fila usa la moneda del cobro, el crédito en USD y solo links https", () => {
  const row = toRechargeRow({
    ...base,
    status: "requires_payment",
    provider: "cobrana",
    amount_cents: 38500,
    currency: "PEN",
    checkout_url: "javascript:alert(1)",
    metadata: { charge_currency: "PEN", credit_amount_cents: 10000, cobrana_code: " HOL123 " },
  });
  assert.equal(row.chargeCurrency, "PEN");
  assert.equal(row.creditUsdCents, 10000);
  assert.equal(row.yapeCode, "HOL123");
  assert.equal(row.checkoutUrl, null);
});

test("primero lo que necesita acción, después por fecha", () => {
  const rows = sortRecharges([
    toRechargeRow({ ...base, id: "ok", created_at: "2026-10-06T16:00:00Z", status: "succeeded", provider: "manual", metadata: {} }),
    toRechargeRow({ ...base, id: "falta", created_at: "2026-10-06T10:00:00Z", status: "requires_payment", provider: "manual", metadata: {} }),
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["falta", "ok"]);
});

test("cripto con pago parcial: dice cuántos USDT faltaron, redondeado hacia arriba", () => {
  const base = {
    id: "i-short",
    created_at: "2026-10-08T01:49:13Z",
    status: "requires_payment",
    provider: "crypto",
    amount_cents: 10900,
    currency: "USD",
    metadata: {
      crypto_mode: "nowpayments",
      crypto_awaiting_remaining: true,
      crypto_pay_amount: 108.775182,
      crypto_actually_paid: 108.445185,
    },
  };
  assert.equal(cryptoMissingUsdt(base), 0.33);
  assert.equal(toRechargeRow(base).cryptoMissingUsdt, 0.33);
  // Ya acreditada o sin faltante: no muestra nada.
  assert.equal(cryptoMissingUsdt({ ...base, status: "succeeded" }), null);
  assert.equal(cryptoMissingUsdt({ ...base, metadata: { ...base.metadata, crypto_awaiting_remaining: false } }), null);
  assert.equal(cryptoMissingUsdt({ ...base, metadata: { ...base.metadata, crypto_actually_paid: 108.775182 } }), null);
  // 0.301 → 0.31: lo que mande tiene que alcanzar.
  assert.equal(cryptoMissingUsdt({ ...base, metadata: { ...base.metadata, crypto_actually_paid: 108.474182 } }), 0.31);
});
