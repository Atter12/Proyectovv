import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { isBelowCryptoMinimum } from "../crypto-limits.ts";
import { buildNowPaymentsInvoiceBody } from "./nowpayments-checkout.ts";
import {
  nowPaymentsAmountMatchesIntent,
  nowPaymentsPaidInFull,
  nowPaymentsWebhookStep,
  parseNowPaymentsIpn,
  verifyNowPaymentsIpnSignature,
} from "./nowpayments-ipn.ts";

const INTENT = "11111111-2222-4333-8444-555555555555";
const INVOICE = "987654321";
const PAYMENT = "555666777";
const INTENT_USD = { amountCents: 2500, currency: "USD" };

function ipn(status: string, extra: Record<string, unknown> = {}) {
  return {
    payment_id: PAYMENT,
    invoice_id: Number(INVOICE),
    payment_status: status,
    order_id: INTENT,
    price_amount: 25,
    price_currency: "usd",
    pay_amount: 25.12,
    pay_currency: "usdttrc20",
    actually_paid: 25.12,
    ...extra,
  };
}

function body(status: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify(ipn(status, extra));
}

function sign(raw: string, secret: string): string {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const sorted = JSON.stringify(sortKeys(parsed));
  return createHmac("sha512", secret).update(sorted).digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys(record[key]);
        return acc;
      }, {});
  }
  return value;
}

test("el HMAC usa el JSON con claves anidadas ordenadas", () => {
  const raw = JSON.stringify({
    z: 1,
    payment_status: "finished",
    extra: { b: 2, a: 1 },
    order_id: INTENT,
    invoice_id: INVOICE,
    pay_amount: 12,
    actually_paid: 12,
    price_amount: 12,
    price_currency: "usd",
  });
  const secret = "ipn-secreto";
  const header = sign(raw, secret);
  assert.equal(verifyNowPaymentsIpnSignature(raw, header, secret), true);
  assert.equal(verifyNowPaymentsIpnSignature(raw, header, "otro"), false);
  assert.equal(verifyNowPaymentsIpnSignature(body("finished", { actually_paid: 1 }), header, secret), false);
});

test("solo finished con el USDT completo acredita, y usa el invoice_id", () => {
  const event = parseNowPaymentsIpn(body("finished"));
  assert.equal(event?.succeeded, true);
  assert.equal(nowPaymentsWebhookStep(event!), "credit");
  assert.equal(event?.providerReference, INVOICE);
  assert.equal(event?.paymentIntentId, INTENT);
  assert.equal(event?.amountCents, 2500);
  assert.equal(event?.currency, "USD");
  assert.equal(nowPaymentsAmountMatchesIntent(event!, INTENT_USD), true);
});

test("waiting, confirming y sending se acusan y no mueven el saldo", () => {
  for (const status of ["waiting", "confirming", "sending"]) {
    const event = parseNowPaymentsIpn(body(status));
    assert.equal(nowPaymentsWebhookStep(event!), "ack");
    assert.equal(event?.succeeded, false);
  }
});

test("confirmed no acredita aunque el monto ya esté", () => {
  const event = parseNowPaymentsIpn(body("confirmed"));
  assert.equal(nowPaymentsWebhookStep(event!), "ack");
});

test("partially_paid y un finished corto no acreditan", () => {
  assert.equal(nowPaymentsWebhookStep(parseNowPaymentsIpn(body("partially_paid", { actually_paid: 10 }))!), "ack");
  const short = parseNowPaymentsIpn(body("finished", { actually_paid: 10 }));
  assert.equal(nowPaymentsWebhookStep(short!), "ack");
  assert.equal(nowPaymentsPaidInFull(ipn("finished", { actually_paid: 10 })), false);
  assert.equal(nowPaymentsPaidInFull(ipn("finished", { actually_paid: 25.119 })), true);
});

test("finished sin actually_paid no acredita", () => {
  const event = parseNowPaymentsIpn(body("finished", { actually_paid: undefined }));
  assert.equal(event?.succeeded, false);
  assert.equal(nowPaymentsWebhookStep(event!), "ack");
});

test("expired cancela y failed/refunded no acreditan", () => {
  assert.equal(nowPaymentsWebhookStep(parseNowPaymentsIpn(body("expired"))!), "mark_cancelled");
  assert.equal(nowPaymentsWebhookStep(parseNowPaymentsIpn(body("failed"))!), "mark_failed");
  assert.equal(nowPaymentsWebhookStep(parseNowPaymentsIpn(body("refunded"))!), "mark_failed");
});

test("un monto USD distinto al de la recarga no se acepta", () => {
  const event = parseNowPaymentsIpn(body("finished", { price_amount: 40 }));
  assert.equal(nowPaymentsAmountMatchesIntent(event!, INTENT_USD), false);
  assert.equal(nowPaymentsAmountMatchesIntent(event!, { amountCents: 4000, currency: "USD" }), true);
});

test("si el precio no viene en USD, no se compara contra la recarga", () => {
  const event = parseNowPaymentsIpn(
    body("finished", { price_currency: "usdttrc20", price_amount: 25.12 }),
  );
  assert.equal(event?.amountCents, undefined);
  assert.equal(event?.currency, undefined);
  assert.equal(nowPaymentsAmountMatchesIntent(event!, INTENT_USD), true);
});

test("confirmed y finished no comparten eventId, para no tragarse el cobro", () => {
  const confirmed = parseNowPaymentsIpn(body("confirmed"));
  const finished = parseNowPaymentsIpn(body("finished"));
  assert.notEqual(confirmed?.eventId, finished?.eventId);
});

test("sin invoice ni pedido no entra; payment_id solo no basta", () => {
  assert.equal(
    parseNowPaymentsIpn(
      JSON.stringify({ payment_id: PAYMENT, payment_status: "finished", actually_paid: 25, pay_amount: 25 }),
    ),
    null,
  );
  const byOrder = parseNowPaymentsIpn(
    JSON.stringify({
      order_id: INTENT,
      payment_status: "finished",
      price_amount: 12,
      price_currency: "usd",
      pay_amount: 12,
      actually_paid: 12,
    }),
  );
  assert.equal(byOrder?.paymentIntentId, INTENT);
  assert.equal(byOrder?.providerReference, null);
  assert.equal(byOrder?.succeeded, true);
});

test("la factura lleva order_id, invoice IPN y USDT TRC20 sin rate fijo", () => {
  const built = buildNowPaymentsInvoiceBody({
    amountCents: 2500,
    currency: "USD",
    paymentIntentId: INTENT,
    appUrl: "https://adsholistic.com/",
    payCurrency: "usdttrc20",
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.body.order_id, INTENT);
  assert.equal(built.body.price_amount, 25);
  assert.equal(built.body.price_currency, "usd");
  assert.equal(built.body.is_fixed_rate, false);
  assert.equal(built.body.pay_currency, "usdttrc20");
  assert.equal(built.body.ipn_callback_url, "https://adsholistic.com/api/webhooks/payments/crypto");
});

test("menos de 12 USD no arma checkout", () => {
  assert.equal(isBelowCryptoMinimum(11.99), true);
  assert.equal(isBelowCryptoMinimum(12), false);
  const built = buildNowPaymentsInvoiceBody({
    amountCents: 1199,
    currency: "USD",
    paymentIntentId: INTENT,
    appUrl: "https://adsholistic.com",
    payCurrency: "usdttrc20",
  });
  assert.equal(built.ok, false);
  if (built.ok) return;
  assert.equal(built.reason, "too_small");
});
