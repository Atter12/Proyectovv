import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const unexpected = () => { throw new Error("Unexpected external side effect"); };
function load(path, mocks = {}, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, URLSearchParams, Buffer, console,
    fetch: unexpected, process: { env: { CREDIT_STRIPE_LOCK_ENABLED: "true" } },
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
