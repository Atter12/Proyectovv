import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { buildWalletFunding } from "../lib/hecom/wallet-funding.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const expected = { clientId: "client-test", paymentIntentId: "intent-test", provider: "stripe" };
function intent(patch = {}, metadata = {}) {
  return { id: "intent-test", amountCents: 11300, currency: "USD", provider: "stripe", ...patch,
    metadata: { source: "dashboard", input_mode: "desired_credit", hecom_cliente_id: "client-test",
      ledger_journal_id: "journal-test", credit_amount_cents: 10000, fee_amount_cents: 1300,
      gross_amount_cents: 11300, wallet_credit_currency: "USD", fee_percent: 13,
      fee_holistic_percent: 10, fee_stripe_surcharge_percent: 3, ...metadata } };
}
const sum = f => f.wallet_credit_cents + f.holistic_fee_cents + f.gateway_surcharge_cents + f.unclassified_cents;
function load(name, mocks, context = {}) {
  const source = readFileSync(new URL(`../lib/hecom/${name}.server.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const sandbox = { exports: mod.exports, module: mod, Buffer, process: { env: {} }, console: { error(){}, warn(){}, info(){} }, ...context,
    require: id => id === "server-only" ? {} : id in mocks ? mocks[id] : require(id) };
  vm.runInNewContext(code, sandbox, { filename: name });
  return mod.exports;
}

test("preserves gross while distinguishing own fee and gateway surcharge", () => {
  const f = buildWalletFunding(intent(), expected);
  assert.equal(f.mode, "wallet_topup");
  assert.equal(f.wallet_credit_cents, 10000); assert.equal(f.holistic_fee_cents, 1000);
  assert.equal(f.gateway_surcharge_cents, 300); assert.equal(f.unclassified_cents, 0);
  assert.equal(sum(f), f.gross_cents); assert.equal(f.source, "dashboard");
  assert.equal(f.payment_intent_id, expected.paymentIntentId); assert.equal(f.ledger_journal_id, "journal-test");
});
test("uses negotiated frozen rates instead of a current or default fee", () => {
  for (const own of [0, 5, 8, 9, 12.5]) {
    const fee = Math.round(10000 * (own + 3) / 100);
    const f = buildWalletFunding(intent({ amountCents: 10000 + fee }, { fee_percent: own + 3,
      fee_holistic_percent: own, fee_amount_cents: fee, gross_amount_cents: 10000 + fee }), expected);
    assert.equal(f.holistic_fee_cents, own * 100); assert.equal(f.gateway_surcharge_cents, 300);
    assert.equal(sum(f), f.gross_cents);
  }
});
test("PEN charges use the original USD quote without relabeling soles or querying FX", () => {
  const f = buildWalletFunding(intent({ amountCents: 37000, currency: "PEN", provider: "manual" }, {
    gross_usd_cents: 11000, fee_amount_cents: 1000, gross_amount_cents: 37000,
    fee_percent: 10, fee_stripe_surcharge_percent: 0 }), { ...expected, provider: "manual" });
  assert.equal(f.gross_cents, 11000); assert.equal(f.holistic_fee_cents, 1000);
  assert.equal(f.gateway_surcharge_cents, 0); assert.equal(sum(f), 11000);
  assert.equal(buildWalletFunding(intent({ currency: "PEN" }), expected), null);
});
test("adjusted PEN quotes preserve the documented inverse rounding with no invented fee cent", () => {
  // Synthetic inverse: 99 PEN cents at 3.48 yields fee 2, while 26 USD cents
  // multiplied by 10% rounds to 3. Preserve the actual frozen inverse fee.
  const charge = 99, rate = 10, fx = 3.48;
  const creditPen = Math.round(charge / (1 + rate / 100));
  const credit = Math.round((creditPen / 100 / fx) * 100);
  const gross = Math.round((charge / 100 / fx) * 100), fee = gross - credit;
  const row = intent({ amountCents: charge, currency: "PEN", provider: "manual" }, {
    credit_amount_cents: credit, fee_amount_cents: fee, gross_amount_cents: charge, gross_usd_cents: gross,
    fee_percent: rate, fee_holistic_percent: rate, fee_stripe_surcharge_percent: 0,
    fx_rate_usd_pen: fx, amount_adjusted_at: "2026-09-21T15:00:00Z",
  });
  const f = buildWalletFunding(row, { ...expected, provider: "manual" });
  assert.notEqual(fee, Math.round(credit * rate / 100));
  assert.equal(f.holistic_fee_cents, fee); assert.equal(sum(f), gross);
  row.metadata.fee_amount_cents += 1;
  assert.equal(buildWalletFunding(row, { ...expected, provider: "manual" }).holistic_fee_cents, 0);
});
test("manual unique cents remain unclassified instead of increasing commission", () => {
  const f = buildWalletFunding(intent({ amountCents: 11007, provider: "manual" }, {
    gross_usd_cents: 11007, gross_amount_cents: 11000, fee_amount_cents: 1000,
    fee_percent: 10, fee_stripe_surcharge_percent: 0, usd_discriminator_cents: 7,
  }), { ...expected, provider: "manual" });
  assert.equal(f.holistic_fee_cents, 1000); assert.equal(f.unclassified_cents, 7);
  assert.equal(sum(f), f.gross_cents);
});
test("legacy intents without separate percentages do not guess gateway or own fee", () => {
  const f = buildWalletFunding(intent({}, { fee_holistic_percent: undefined, fee_stripe_surcharge_percent: undefined }), expected);
  assert.equal(f.mode, "wallet_topup"); assert.equal(f.wallet_credit_cents, 10000);
  assert.equal(f.holistic_fee_cents, 0); assert.equal(f.gateway_surcharge_cents, 0);
  assert.equal(f.unclassified_cents, 1300); assert.equal(f.fee_holistic_percent, null);
});
test("debt payments do not create wallet principal or erase the debt charge fee", () => {
  const f = buildWalletFunding(intent({}, { source: "credito_detach", purpose: "credito_lock_debt",
    skip_wallet_credit: true, fee_amount_cents: 0 }), expected);
  assert.equal(f.mode, "credit_debt"); assert.equal(f.wallet_credit_cents, 0);
  assert.equal(f.holistic_fee_cents, 0); assert.equal(f.unclassified_cents, 11300);
  const surcharge = buildWalletFunding(intent({}, { purpose: "credito_lock_debt", gateway_surcharge_cents: 100 }), expected);
  assert.equal(surcharge.gateway_surcharge_cents, 100); assert.equal(surcharge.unclassified_cents, 11200);
});
test("missing ledger and non-wallet purposes remain unclassified", () => {
  for (const patch of [{ ledger_journal_id: null }, { input_mode: null }, { skip_wallet_credit: true }, { wallet_credit_currency: "PEN" }]) {
    const f = buildWalletFunding(intent({}, patch), expected);
    assert.equal(f.mode, "unknown"); assert.equal(f.unclassified_cents, f.gross_cents);
  }
});
test("identity conflicts, invalid money and absent foreign quotes fail closed", () => {
  for (const [row, match] of [[intent({ id: "other" }), expected], [intent({}, { hecom_cliente_id: "other" }), expected],
    [intent(), { ...expected, provider: "manual" }], [intent({ amountCents: NaN }), expected],
    [intent({ amountCents: 0 }), expected], [intent({}, { gross_usd_cents: 99999 }), expected],
    [intent({ currency: "EUR" }), expected], [intent({}, { gross_usd_cents: "" }), expected]]) {
    assert.equal(buildWalletFunding(row, match), null);
  }
});
test("contradictory percentages or fee amounts never turn into own income", () => {
  for (const patch of [{ fee_percent: 99 }, { fee_amount_cents: 1200 }, { fee_holistic_percent: -1 },
    { fee_stripe_surcharge_percent: "3oops" }, { fee_percent: 13.001 }]) {
    const f = buildWalletFunding(intent({}, patch), expected);
    assert.equal(f.holistic_fee_cents, 0); assert.equal(sum(f), f.gross_cents);
  }
});
test("rounding and string metadata conserve every cent", () => {
  const f = buildWalletFunding(intent({ amountCents: 4 }, { credit_amount_cents: "3", gross_amount_cents: "4",
    fee_amount_cents: "1", fee_percent: "33.33", fee_holistic_percent: "16.67", fee_stripe_surcharge_percent: "16.66" }), expected);
  assert.equal(f.holistic_fee_cents, 1); assert.equal(f.gateway_surcharge_cents, 0); assert.equal(sum(f), 4);
});

function bridge({ fresh = intent(), response = { ok: true, idempotent: true, codigo: "AH-STRIPE-intent-test", funding_version: 1, funding_persisted: true }, enabled = true, status = 200 } = {}) {
  const requests = [], reads = [], updates = [];
  const api = load("wallet-cobro-bridge", {
    "@/lib/env/env.server": { serverEnv: { hecomCobrosBridgeEnabled: enabled, hecomCobrosBridgeUrl: "https://hecom.test/bridge", hecomCobrosBridgeSecret: "test-only" } },
    "@/lib/hecom/supabase.server": { createHecomAdminClient: () => { updates.push("align-called"); throw new Error("No alignment for enrichment"); } },
    "@/lib/payments/payment-intents.server": { getPaymentIntentByIdInternal: async id => { reads.push(id); return fresh; } },
    "@/lib/hecom/wallet-funding": { buildWalletFunding },
  }, { fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: status >= 200 && status < 300, status, json: async () => response }; } });
  return { api, requests, reads, updates };
}
test("direct bridge callers get fresh evidence and never change an existing receipt period", async () => {
  const b = bridge();
  const result = await b.api.syncWalletDepositCobroBestEffort({ hecomClienteId: expected.clientId,
    paymentIntentId: expected.paymentIntentId, provider: "stripe", amountCents: 1, feeCents: 1 });
  assert.equal(b.reads.length, 1); assert.equal(b.requests.length, 1); assert.equal(b.updates.length, 0);
  const body = b.requests[0].body;
  assert.equal(body.monto_bruto, 113); assert.equal(body.monto_neto, 100); assert.equal(body.fee_holistic, 10);
  assert.equal(body.funding.gateway_surcharge_cents, 300);
  assert.equal(body.funding_only, undefined, "A new, never-synced payment may create its receipt");
  assert.equal(result.fundingVersion, 1); assert.equal(result.fundingPersisted, true);
});
test("bridge does not post when fresh source or identity cannot be verified", async () => {
  for (const fresh of [null, intent({}, { hecom_cliente_id: "other" })]) {
    const b = bridge({ fresh });
    const result = await b.api.syncWalletDepositCobroBestEffort({ hecomClienteId: expected.clientId,
      paymentIntentId: expected.paymentIntentId, provider: "stripe", amountCents: 11300 });
    assert.equal(result.ok, false); assert.equal(b.requests.length, 0);
  }
});
test("bridge propagates legacy acknowledgement as unpersisted funding", async () => {
  const b = bridge({ response: { ok: true, idempotent: true } });
  const result = await b.api.syncWalletDepositCobroBestEffort({ hecomClienteId: expected.clientId,
    paymentIntentId: expected.paymentIntentId, provider: "stripe", amountCents: 11300 });
  assert.equal(result.fundingVersion, undefined); assert.equal(result.fundingPersisted, false);
});
test("prior successful or held enrichment always sends funding_only, while skipped sync does not imply existence", async () => {
  for (const [marker, required] of [[{ ok: true }, true], [{ ok: true, skipped: false }, true],
    [{ ok: false, funding_only: true }, true], [{ ok: true, skipped: true }, false], [{ ok: false }, false]]) {
    const b = bridge({ fresh: intent({}, { hecom_cobro_sync: marker }) });
    await b.api.syncWalletDepositCobroBestEffort({ hecomClienteId: expected.clientId,
      paymentIntentId: expected.paymentIntentId, provider: "stripe", amountCents: 11300 });
    assert.equal(b.requests[0].body.funding_only, required ? true : undefined);
    assert.equal(b.updates.length, 0);
  }
});

function ensure({ syncResult = { ok: true, skipped: false, cobroId: "receipt-test", fundingVersion: 1, fundingPersisted: true }, syncMarker = { ok: true }, fresh, bridgeApi } = {}) {
  const row = fresh ?? intent({}, { hecom_cobro_sync: syncMarker }), writes = [], calls = [];
  const api = load("ensure-wallet-cobro", {
    "@/lib/payments/payment-intents.server": {
      getPaymentIntentByIdInternal: async () => row,
      mergePaymentIntentMetadata: async (id, value) => { writes.push(value); Object.assign(row.metadata, value); },
    },
    "@/lib/hecom/wallet-funding": { buildWalletFunding },
    "@/lib/hecom/wallet-cobro-bridge.server": { syncWalletDepositCobroBestEffort: async value => { calls.push(value); return bridgeApi ? bridgeApi.syncWalletDepositCobroBestEffort(value) : syncResult; } },
  });
  return { api, row, writes, calls };
}
test("old successful receipts retry enrichment once and acknowledgement suppresses unchanged repeats", async () => {
  const e = ensure();
  await e.api.ensureHecomWalletCobroSynced({ intent: e.row });
  assert.equal(e.calls.length, 1); assert.equal(e.writes[0].hecom_cobro_sync.funding_version, 1);
  assert.equal(e.writes[0].hecom_cobro_sync.funding_only, true);
  await e.api.ensureHecomWalletCobroSynced({ intent: e.row });
  assert.equal(e.calls.length, 1);
  e.row.metadata.ledger_journal_id = "corrected-journal";
  await e.api.ensureHecomWalletCobroSynced({ intent: e.row });
  assert.equal(e.calls.length, 2);
});
test("missing old receipt 404 stays funding_only across retries without a persisted funding marker", async () => {
  const row = intent({}, { hecom_cobro_sync: { ok: true, codigo: "AH-STRIPE-intent-test" } });
  const b = bridge({ fresh: row, status: 404, response: { ok: false, error: "Original receipt not found" } });
  const e = ensure({ fresh: row, bridgeApi: b.api });
  for (let attempt = 0; attempt < 2; attempt++) {
    await e.api.ensureHecomWalletCobroSynced({ intent: row });
    assert.equal(b.requests[attempt].body.funding_only, true);
    const marker = row.metadata.hecom_cobro_sync;
    assert.equal(marker.ok, false); assert.equal(marker.funding_only, true);
    assert.equal(marker.funding_version, undefined); assert.equal(marker.funding_fingerprint, undefined);
  }
  assert.equal(b.updates.length, 0);
});
test("skips, old endpoint responses and failed persistence never mark funding synchronized", async () => {
  for (const syncResult of [{ ok: true, skipped: true, fundingVersion: 1, fundingPersisted: true },
    { ok: true }, { ok: true, fundingVersion: 1, fundingPersisted: false }, { ok: false }, null]) {
    const e = ensure({ syncResult });
    await e.api.ensureHecomWalletCobroSynced({ intent: e.row });
    assert.equal(e.writes[0].hecom_cobro_sync.funding_version, undefined);
    assert.equal(e.writes[0].hecom_cobro_sync.funding_only, true);
    await e.api.ensureHecomWalletCobroSynced({ intent: e.row });
    assert.equal(e.calls.length, 2);
  }
});
