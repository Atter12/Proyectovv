import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOCHARGE_MIN_CENTS,
  autochargeAmounts,
  buildWhopCardSetupBody,
  buildWhopOffSessionPaymentBody,
  decideAutocharge,
  isAutochargeDay,
  limaDateKey,
  resolveAutochargeMode,
  type AutochargeDecisionInput,
} from "./autocharge.ts";
import { parseWhopSavedCard, parseWhopWebhookPayload } from "../providers/whop-webhook.ts";

// Lunes 12/10/2026 a las 9:00 de Lima = 14:00 UTC.
const MONDAY = new Date("2026-10-12T14:00:00Z");
const WEDNESDAY = new Date("2026-10-14T14:00:00Z");

function base(over: Partial<AutochargeDecisionInput> = {}): AutochargeDecisionInput {
  return {
    now: WEDNESDAY,
    debtCents: 20_000,
    cupoCents: 50_000,
    softCapPercent: 90,
    failedSince: null,
    frozenAt: null,
    pendingCharge: false,
    chargedToday: false,
    ...over,
  };
}

test("el día de cobro es lunes en hora de Lima", () => {
  assert.equal(isAutochargeDay(MONDAY), true);
  assert.equal(isAutochargeDay(WEDNESDAY), false);
  // Lunes 03:00 UTC todavía es domingo en Lima.
  assert.equal(isAutochargeDay(new Date("2026-10-12T03:00:00Z")), false);
  assert.equal(limaDateKey(new Date("2026-10-13T03:00:00Z")), "2026-10-12");
});

test("modo por defecto apagado", () => {
  assert.equal(resolveAutochargeMode(undefined), "off");
  assert.equal(resolveAutochargeMode("LIVE"), "live");
  assert.equal(resolveAutochargeMode("dry_run"), "dry_run");
  assert.equal(resolveAutochargeMode("si"), "off");
});

test("cobra los lunes y espera el resto de la semana", () => {
  assert.equal(decideAutocharge(base({ now: MONDAY })).action, "charge");
  assert.equal(decideAutocharge(base()).action, "none");
});

test("cobra antes del lunes si llegó al tope del cupo", () => {
  const d = decideAutocharge(base({ debtCents: 45_000 }));
  assert.deepEqual(d, { action: "charge", reason: "tope_cupo" });
});

test("deuda chica no se cobra", () => {
  assert.equal(decideAutocharge(base({ now: MONDAY, debtCents: AUTOCHARGE_MIN_CENTS - 1 })).action, "none");
});

test("un cobro esperando respuesta de Whop no se repite", () => {
  assert.equal(decideAutocharge(base({ now: MONDAY, pendingCharge: true })).action, "wait_pending");
  assert.equal(decideAutocharge(base({ now: MONDAY, chargedToday: true })).action, "none");
});

test("rechazo: reintenta cada día y congela a las 48 h", () => {
  const failedSince = new Date(WEDNESDAY.getTime() - 24 * 3_600_000);
  assert.deepEqual(decideAutocharge(base({ failedSince })), { action: "charge", reason: "reintento" });
  const old = new Date(WEDNESDAY.getTime() - 49 * 3_600_000);
  assert.deepEqual(decideAutocharge(base({ failedSince: old })), {
    action: "freeze",
    reason: "rechazo_sin_pago_48h",
  });
  // Ya congelado: sigue reintentando el cobro.
  assert.equal(decideAutocharge(base({ failedSince: old, frozenAt: WEDNESDAY })).action, "charge");
});

test("si pagó por otro lado, se limpia el bloqueo", () => {
  const failedSince = new Date(WEDNESDAY.getTime() - 60 * 3_600_000);
  assert.deepEqual(decideAutocharge(base({ debtCents: 0, failedSince, frozenAt: WEDNESDAY })), {
    action: "clear",
    reason: "deuda_pagada",
  });
  assert.equal(decideAutocharge(base({ debtCents: 0 })).action, "none");
});

test("el cobro suma el recargo de la pasarela", () => {
  assert.deepEqual(autochargeAmounts(20_000, 6), { grossCents: 21_200, surchargeCents: 1_200 });
  assert.deepEqual(autochargeAmounts(10_050, 0), { grossCents: 10_050, surchargeCents: 0 });
});

test("checkout de Whop en modo setup: solo tarjeta y sin plan", () => {
  const body = buildWhopCardSetupBody({
    companyId: "biz_1",
    redirectUrl: "https://www.adsholistic.com/payments?billing_setup=whop",
    metadata: { purpose: "credito_tarjeta", organization_id: "org_1" },
  });
  assert.equal(body.mode, "setup");
  assert.equal(body.account_id, "biz_1");
  assert.equal("plan" in body, false);
  assert.deepEqual((body.payment_method_configuration as { enabled: string[] }).enabled, ["card"]);
});

test("cobro sin el cliente presente: miembro, tarjeta y plan con el monto", () => {
  const body = buildWhopOffSessionPaymentBody({
    companyId: "biz_1",
    memberId: "mber_1",
    paymentMethodId: "payt_1",
    amountCents: 21_200,
    metadata: { payment_intent_id: "pi_1" },
  });
  assert.equal(body.member_id, "mber_1");
  assert.equal(body.payment_method_id, "payt_1");
  const plan = body.plan as Record<string, unknown>;
  assert.equal(plan.initial_price, 212);
  assert.equal(plan.currency, "usd");
  assert.equal(plan.plan_type, "one_time");
  assert.deepEqual(body.metadata, { payment_intent_id: "pi_1" });
});

test("webhook setup_intent.succeeded trae la tarjeta guardada", () => {
  const event = parseWhopWebhookPayload(
    JSON.stringify({
      id: "evt_1",
      type: "setup_intent.succeeded",
      data: {
        id: "sint_1",
        status: "succeeded",
        member_id: "mber_1",
        payment_method_id: "payt_1",
        payment_instrument: { card: { brand: "visa", last4: "4242", exp_month: 10, exp_year: 2031 } },
        metadata: { purpose: "credito_tarjeta", organization_id: "org_1" },
      },
    }),
  );
  assert.ok(event);
  assert.equal(event.succeeded, false);
  assert.deepEqual(event.savedCard, {
    setupIntentId: "sint_1",
    memberId: "mber_1",
    paymentMethodId: "payt_1",
    brand: "visa",
    last4: "4242",
    expMonth: 10,
    expYear: 2031,
    metadata: { purpose: "credito_tarjeta", organization_id: "org_1" },
  });
});

test("tarjeta guardada con el formato viejo de Whop (payment_method.id)", () => {
  const card = parseWhopSavedCard({
    id: "sint_2",
    member: { id: "mber_2" },
    payment_method: { id: "payt_2" },
    metadata: null,
  });
  assert.equal(card?.paymentMethodId, "payt_2");
  assert.equal(card?.memberId, "mber_2");
  assert.equal(parseWhopSavedCard({ id: "sint_3", status: "processing", member_id: "m", payment_method_id: "p" }), null);
});

test("payment.failed trae el motivo del rechazo", () => {
  const event = parseWhopWebhookPayload(
    JSON.stringify({
      id: "evt_2",
      type: "payment.failed",
      data: { id: "pay_1", metadata: { payment_intent_id: "pi_1" }, failure_message: "Fondos insuficientes" },
    }),
  );
  assert.equal(event?.failed, true);
  assert.equal(event?.failureMessage, "Fondos insuficientes");
  assert.equal(event?.paymentIntentId, "pi_1");
});
