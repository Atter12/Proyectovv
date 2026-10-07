import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { cryptoIntentAcceptsVoucherProof } from "../../../types/payment.ts";
import { CRYPTO_MIN_USD, isBelowCryptoMinimum } from "../crypto-limits.ts";
import { buildNowPaymentsInvoiceBody } from "./nowpayments-checkout.ts";
import {
  nowPaymentsAmountMatchesIntent,
  nowPaymentsSortedJson,
  nowPaymentsWebhookStep,
  parseNowPaymentsIpn,
  verifyNowPaymentsIpnSignature,
} from "./nowpayments-ipn.ts";

/**
 * Recorre recarga → factura → IPN → decisión de ledger, sin pegarle a NOWPayments live.
 * Un pago real en prod sigue siendo el cierre operativo.
 */
test("flujo de producto: recarga 25 USD → finished completo → credit", () => {
  const intentId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const amountCents = 2500;
  const built = buildNowPaymentsInvoiceBody({
    amountCents,
    currency: "USD",
    paymentIntentId: intentId,
    appUrl: "https://www.adsholistic.com",
    payCurrency: "usdttrc20",
    minUsd: CRYPTO_MIN_USD,
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;

  const ipn = {
    payment_id: 9001,
    invoice_id: 4302578480,
    payment_status: "finished",
    order_id: built.body.order_id,
    price_amount: built.body.price_amount,
    price_currency: built.body.price_currency,
    pay_amount: 25.12,
    pay_currency: "usdttrc20",
    actually_paid: 25.12,
    ipn_callback_url: built.body.ipn_callback_url,
  };
  const raw = JSON.stringify(ipn);
  const secret = "ipn-de-prueba";
  const signature = createHmac("sha512", secret)
    .update(nowPaymentsSortedJson(JSON.parse(raw)))
    .digest("hex");

  assert.equal(verifyNowPaymentsIpnSignature(raw, signature, secret), true);
  const event = parseNowPaymentsIpn(raw);
  assert.ok(event);
  assert.equal(event.paymentIntentId, intentId);
  assert.equal(event.providerReference, "4302578480");
  assert.equal(nowPaymentsAmountMatchesIntent(event, { amountCents, currency: "USD" }), true);
  assert.equal(nowPaymentsWebhookStep(event, "requires_payment"), "credit");
});

test("flujo de producto: confirmed no acredita; finished después sí", () => {
  const base = {
    payment_id: 1,
    invoice_id: 2,
    order_id: "intent-1",
    price_amount: 12,
    price_currency: "usd",
    pay_amount: 12,
    actually_paid: 12,
  };
  const confirmed = parseNowPaymentsIpn(JSON.stringify({ ...base, payment_status: "confirmed" }));
  const finished = parseNowPaymentsIpn(JSON.stringify({ ...base, payment_status: "finished" }));
  assert.equal(nowPaymentsWebhookStep(confirmed!, "requires_payment"), "ack");
  assert.equal(nowPaymentsWebhookStep(finished!, "requires_payment"), "credit");
});

test("flujo de producto: pago corto cierra; refund post-crédito no pisa el ledger", () => {
  const short = parseNowPaymentsIpn(
    JSON.stringify({
      invoice_id: 3,
      order_id: "intent-2",
      payment_status: "finished",
      price_amount: 12,
      price_currency: "usd",
      pay_amount: 12,
      actually_paid: 4,
    }),
  );
  assert.equal(nowPaymentsWebhookStep(short!, "requires_payment"), "mark_failed");

  const refunded = parseNowPaymentsIpn(
    JSON.stringify({
      invoice_id: 3,
      order_id: "intent-2",
      payment_status: "refunded",
      price_amount: 12,
      price_currency: "usd",
      pay_amount: 12,
      actually_paid: 12,
    }),
  );
  assert.equal(nowPaymentsWebhookStep(refunded!, "succeeded"), "ignore_after_credit");
});

test("el checkout NOWPayments no acepta voucher; uno viejo sí", () => {
  assert.equal(cryptoIntentAcceptsVoucherProof({ crypto_mode: "nowpayments" }), false);
  assert.equal(cryptoIntentAcceptsVoucherProof({ crypto_mode: "manual_proof" }), true);
  assert.equal(cryptoIntentAcceptsVoucherProof({}), true);
});

test("el mínimo de 12 USD es el mismo en modal y factura", () => {
  assert.equal(isBelowCryptoMinimum(11.99), true);
  const built = buildNowPaymentsInvoiceBody({
    amountCents: 1200,
    currency: "USD",
    paymentIntentId: "intent",
    appUrl: "https://www.adsholistic.com",
    payCurrency: "usdttrc20",
    minUsd: CRYPTO_MIN_USD,
  });
  assert.equal(built.ok, true);
});
