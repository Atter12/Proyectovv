import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { parseNowPaymentsIpn } from "./nowpayments-ipn.ts";
import { reconcileNowPayments } from "./nowpayments-reconciliation.ts";

const require = createRequire(import.meta.url);
function load(relativePath, mocks) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console, Date, Request, Response,
    require: (name) => mocks[name] ?? (name.startsWith("node:") ? require(name) : {}),
  });
  return exports;
}

function harness({ succeeded = false, failOnce = false } = {}) {
  const intent = { id: "steve", provider: "crypto", providerReference: "5000861814",
    amountCents: 6600, currency: "USD", organizationId: "org", createdBy: null,
    status: succeeded ? "succeeded" : "requires_payment", metadata: {} };
  const events = new Map();
  const journals = new Map();
  const ledgerKeys = [];
  let failed = 0;
  const records = {
    getPaymentIntentByIdInternal: async () => ({ ...intent }),
    getPaymentIntentByProviderReference: async () => ({ ...intent }),
    recordWebhookEvent: async ({ eventId, payload }) => {
      const duplicate = events.has(eventId);
      if (!duplicate) events.set(eventId, payload);
      return { duplicate };
    },
    markWebhookEventProcessed: async () => {},
    markWebhookEventFailed: async () => { failed++; },
    mergePaymentIntentMetadata: async (_id, patch, options) => {
      if (options?.unlessSucceeded && intent.status === "succeeded") return;
      intent.metadata = { ...intent.metadata, ...patch };
    },
    updatePaymentIntentRecord: async (_id, patch, options) => {
      if (options?.unlessSucceeded && intent.status === "succeeded") return;
      Object.assign(intent, patch);
    },
    claimPaymentIntentSucceeded: async () => false,
  };
  const success = load("../create-intent.server.ts", {
    "@/lib/payments/payment-intents.server": records,
    "@/lib/ledger/ledger.server": { confirmDepositInLedger: async (input) => {
      ledgerKeys.push(input.idempotencyKey);
      if (failOnce) { failOnce = false; throw new Error("temporary ledger failure"); }
      if (!journals.has(input.idempotencyKey)) journals.set(input.idempotencyKey, 6000);
      intent.status = "succeeded";
      return "journal";
    } },
    "@/lib/hecom/ensure-wallet-cobro.server": { ensureHecomWalletCobroSynced: async () => {} },
  });
  const route = load("../../../app/api/webhooks/payments/[provider]/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/payments/create-intent.server": success,
    "@/lib/payments/payment-intents.server": records,
    "@/lib/payments/crypto-ipn-ops.server": { recordCryptoIpnOpsEvent: async () => {} },
    "@/types/payment": { isPaymentGatewayId: (p) => p === "crypto" },
    "@/lib/payments/providers": { getPaymentProvider: () => ({
      verifyWebhook: async ({ rawBody }) => parseNowPaymentsIpn(rawBody),
    }) },
    "@/lib/payments/providers/nowpayments-reconciliation.server": {
      loadNowPaymentsReconciliation: async (i) => reconcileNowPayments([...events.values()], i),
    },
  });
  const post = (body) => route.POST(new Request("https://test/api/webhooks/payments/crypto", {
    method: "POST", body: JSON.stringify(body),
  }), { params: Promise.resolve({ provider: "crypto" }) });
  return { post, intent, journals, ledgerKeys, failed: () => failed, success };
}
const base = { order_id: "steve", invoice_id: "5000861814", payment_id: "first",
  price_amount: 66, price_currency: "usd", pay_currency: "usdttrc20", pay_amount: 65.941421,
  actually_paid: 0, payment_status: "waiting" };
const first = { ...base, actually_paid: 56, payment_status: "partially_paid" };
const second = { ...first, payment_id: "second", actually_paid: 10, pay_amount: 65.907723 };

test("route credits split payments once; retries and late partial events preserve credit", async () => {
  const h = harness();
  await h.post(base);
  await h.post(first);
  assert.equal(h.journals.size, 0);
  assert.equal(h.intent.metadata.crypto_actually_paid, 56);
  assert.equal((await h.post(second)).status, 200);
  assert.equal(h.journals.size, 1);
  assert.equal(h.intent.metadata.crypto_actually_paid, 66);
  assert.equal(h.intent.metadata.crypto_awaiting_remaining, false);
  await Promise.all([h.post(first), h.post(second), h.post({ ...base, payment_status: "expired" })]);
  assert.equal(h.journals.size, 1);
  assert.equal(h.intent.status, "succeeded");
  assert.equal(h.intent.metadata.crypto_awaiting_remaining, false);
});

test("a failed delivery is processed on retry, not swallowed as a duplicate", async () => {
  const h = harness({ failOnce: true });
  await h.post(base); await h.post(first);
  assert.equal((await h.post(second)).status, 500);
  assert.equal(h.failed(), 1);
  assert.equal((await h.post(second)).status, 200);
  assert.equal(h.journals.size, 1);
});

test("Steve's existing manual credit never triggers another deposit", async () => {
  const h = harness({ succeeded: true });
  await h.post(base); await h.post(first); await h.post(second);
  assert.equal(h.ledgerKeys.length, 0);
  assert.equal(h.intent.status, "succeeded");
});

test("concurrent successful processors use the same ledger idempotency key", async () => {
  const h = harness();
  await Promise.all(["event-a", "event-b"].map((webhookEventId) => h.success.processSuccessfulPaymentIntent({
    provider: "crypto", paymentIntentId: "steve", providerReference: "5000861814", webhookEventId,
  })));
  assert.equal(h.ledgerKeys.length, 2);
  assert.equal(new Set(h.ledgerKeys).size, 1);
  assert.equal(h.ledgerKeys[0], "ledger:deposit:payment_intent:steve");
  assert.equal(h.journals.size, 1);
});
