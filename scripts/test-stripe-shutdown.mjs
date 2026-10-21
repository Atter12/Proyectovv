import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const unexpected = () => { throw new Error("Unexpected external side effect"); };
function load(path, mocks = {}, globals = {}, extraEnv = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, URLSearchParams, Buffer, console,
    fetch: unexpected, process: { env: { CREDIT_STRIPE_LOCK_ENABLED: "true", ...extraEnv } },
    require: (id) => id in mocks ? mocks[id] : id.startsWith("node:") ? require(id) : {},
    ...globals,
  });
  return mod.exports;
}
const policy = load("lib/payments/stripe-policy.ts");
const env = { stripeSecretKey: "configured", paymentsDefaultProvider: "stripe" };

test("Stripe is absent from choices and cannot be the configured default", () => {
  const config = load("lib/payments/gateway-config.ts", { "@/lib/env/env.server": { serverEnv: env } });
  assert.equal(config.PAYMENT_GATEWAYS.some((g) => g.id === "stripe"), false);
  assert.equal(config.isGatewayInMaintenance("stripe"), true);
  assert.equal(config.getDefaultGatewayId(), "cobrana");
  for (const provider of ["manual", "crypto", "cobrana"]) {
    assert.equal(config.isGatewayInMaintenance(provider), false);
  }
});

test("direct checkout and deposit creation reject before network or database writes", async () => {
  const { StripePaymentProvider } = load("lib/payments/providers/stripe.provider.ts", {
    "../stripe-policy": policy, "@/lib/env/env.server": { serverEnv: env },
  });
  const provider = new StripePaymentProvider();
  assert.equal(provider.isConfigured(), false);
  await assert.rejects(provider.createCheckout({}), /deshabilitados/);
  const service = load("lib/payments/create-intent.server.ts", { "./stripe-policy": policy });
  await assert.rejects(service.createPaymentIntentForSession({}, { provider: "stripe" }), /deshabilitados/);
});

test("saved cards, setup sessions and scheduled charges cannot call Stripe", async () => {
  const billing = load("lib/payments/stripe-billing.server.ts", {
    "./stripe-policy": policy, "@/lib/env/env.server": { serverEnv: env },
  });
  await assert.rejects(billing.createStripeCustomer({ email: "test@example.com", organizationId: "test" }), /deshabilitados/);
  await assert.rejects(billing.createStripeSetupCheckoutSession({ stripeCustomerId: "cus_test", organizationId: "test" }), /deshabilitados/);
  await assert.rejects(billing.chargeStripeOffSession({ stripeCustomerId: "cus_test", amountCents: 100, currency: "USD", metadata: {} }), /deshabilitados/);
  const auto = load("lib/payments/auto-recharge/auto-recharge.server.ts", { "../stripe-policy": policy });
  await assert.rejects(auto.runCalendarAutoRechargeForRule({}), /deshabilitados/);
  const lock = load("lib/payments/credit-lock/credit-lock.server.ts", { "../stripe-policy": policy });
  assert.equal(lock.CREDIT_STRIPE_LOCK_ENABLED, false);
});

test("authenticated stale clients receive 503 for either Stripe request field", async () => {
  const route = load("app/api/payments/intents/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/payments/stripe-policy": policy,
    "@/lib/auth/session.server": { getSession: async () => ({ id: "test", permissions: [] }) },
    "@/lib/auth/permissions": { hasPermission: () => true },
    "@/lib/hecom/selected-cliente.server": { getActingAsCliente: async () => null },
    "@/lib/payments/funding-roles.server": {
      resolvePaymentsFundingCapabilities: async () => ({ canClientStripeFund: true }),
      withActAsClienteView: (value) => value,
    },
  });
  for (const field of ["provider", "gatewayId"]) {
    const response = await route.POST(new Request("https://example.test/api/payments/intents", {
      method: "POST", body: JSON.stringify({ amount: 100, [field]: "stripe" }),
    }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /deshabilitados/);
  }
});

// Con la LLC de Stripe Atlas: STRIPE_PAYMENTS_ENABLED=true + clave reactivan solo Stripe.
const enabledPolicy = load("lib/payments/stripe-policy.ts", {}, {}, { STRIPE_PAYMENTS_ENABLED: "true" });

test("STRIPE_PAYMENTS_ENABLED=true shows Stripe and lets it be selected", () => {
  assert.equal(enabledPolicy.STRIPE_PAYMENTS_ENABLED, true);
  const config = load("lib/payments/gateway-config.ts", {
    "@/lib/env/env.server": { serverEnv: env },
    "@/lib/payments/stripe-policy": enabledPolicy,
  });
  assert.equal(config.PAYMENT_GATEWAYS[0].id, "stripe");
  assert.equal(config.isGatewayInMaintenance("stripe"), false);
  assert.equal(config.getDefaultGatewayId(), "stripe");
  assert.equal(config.isGatewayInMaintenance("whop"), true);
});

test("flag on but no secret key keeps Stripe hidden", () => {
  const config = load("lib/payments/gateway-config.ts", {
    "@/lib/env/env.server": { serverEnv: { ...env, stripeSecretKey: "" } },
    "@/lib/payments/stripe-policy": enabledPolicy,
  });
  assert.equal(config.PAYMENT_GATEWAYS.some((g) => g.id === "stripe"), false);
  assert.equal(config.isGatewayInMaintenance("stripe"), true);
});

test("refund and dispute webhooks are flagged, never treated as payments", async () => {
  const { StripePaymentProvider } = load("lib/payments/providers/stripe.provider.ts", {
    "../stripe-policy": enabledPolicy,
    "@/lib/env/env.server": { serverEnv: { ...env, stripeWebhookSecret: "", isProduction: false } },
  });
  const provider = new StripePaymentProvider();
  const refund = await provider.verifyWebhook({ rawBody: JSON.stringify({
    id: "evt_r", type: "charge.refunded",
    data: { object: { id: "ch_1", payment_intent: "pi_1", amount_refunded: 5000, currency: "usd" } },
  }), signature: null });
  assert.equal(refund.reversal, "refund");
  assert.equal(refund.amountCents, 5000);
  assert.equal(refund.stripePaymentIntentRef, "pi_1");
  assert.equal(refund.succeeded, false);
  const dispute = await provider.verifyWebhook({ rawBody: JSON.stringify({
    id: "evt_d", type: "charge.dispute.created",
    data: { object: { id: "dp_1", payment_intent: "pi_2", amount: 11300, currency: "usd", reason: "fraudulent" } },
  }), signature: null });
  assert.equal(dispute.reversal, "dispute");
  assert.equal(dispute.reversalReason, "fraudulent");
  assert.equal(dispute.succeeded, false);
  const paid = await provider.verifyWebhook({ rawBody: JSON.stringify({
    id: "evt_p", type: "checkout.session.completed",
    data: { object: { id: "cs_1", client_reference_id: "int_1", amount_total: 11300, currency: "usd" } },
  }), signature: null });
  assert.equal(paid.succeeded, true);
  assert.equal(paid.paymentIntentId, "int_1");
  assert.equal(paid.reversal, undefined);
});

test("STRIPE_STAFF_ONLY (default on) limits Stripe to staff and super admin", () => {
  assert.equal(enabledPolicy.STRIPE_STAFF_ONLY, true);
  const client = { isStaff: false, isSuperAdmin: false };
  assert.equal(enabledPolicy.canUseStripe(client), false);
  assert.equal(enabledPolicy.canUseStripe({ isStaff: true, isSuperAdmin: false }), true);
  assert.equal(enabledPolicy.canUseStripe({ isStaff: false, isSuperAdmin: true }), true);
  const open = load("lib/payments/stripe-policy.ts", {}, {}, { STRIPE_PAYMENTS_ENABLED: "true", STRIPE_STAFF_ONLY: "false" });
  assert.equal(open.canUseStripe(client), true);
});

test("a client cannot force a Stripe intent while staff-only is on", async () => {
  const route = load("app/api/payments/intents/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/payments/stripe-policy": enabledPolicy,
    "@/lib/auth/session.server": { getSession: async () => ({ id: "test", permissions: [] }) },
    "@/lib/auth/permissions": { hasPermission: () => true },
    "@/lib/hecom/selected-cliente.server": { getActingAsCliente: async () => null },
    "@/lib/payments/funding-roles.server": {
      resolvePaymentsFundingCapabilities: async () => ({ isStaff: false, isSuperAdmin: false, canClientStripeFund: true }),
      withActAsClienteView: (value) => value,
    },
  });
  const response = await route.POST(new Request("https://example.test/api/payments/intents", {
    method: "POST", body: JSON.stringify({ amount: 100, provider: "stripe" }),
  }));
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /tarjeta/);
});
