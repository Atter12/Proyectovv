import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { buildWalletFunding } from "../lib/hecom/wallet-funding.ts";
import { paymentProofReference } from "../lib/hecom/payment-proof.ts";

const require = createRequire(import.meta.url), ts = require("typescript");
const source = readFileSync(new URL("../lib/hecom/payment-detail.server.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
vm.runInNewContext(compiled, { exports: mod.exports, module: mod, Buffer, URL, Request, Response, Date, AbortSignal,
  require: id => id === "server-only" ? {} : id === "@/lib/hecom/wallet-funding" ? { buildWalletFunding } :
    id === "@/lib/hecom/payment-proof" ? { paymentProofReference } : require(id) });
const { handleHecomPaymentDetail } = mod.exports;
const ids = { client: "00000000-0000-4000-8000-000000000001", payment: "00000000-0000-4000-8000-000000000002",
  org: "00000000-0000-4000-8000-000000000003", wallet: "00000000-0000-4000-8000-000000000004",
  journal: "00000000-0000-4000-8000-000000000005", other: "00000000-0000-4000-8000-000000000006" };
function payment(patch = {}, meta = {}) {
  return { id: ids.payment, organization_id: ids.org, wallet_id: ids.wallet, status: "succeeded",
    amount_cents: 11300, currency: "USD", provider: "stripe", provider_reference: "pi_test_123",
    created_at: "2026-09-03T12:00:00Z", succeeded_at: "2026-09-03T12:01:00Z", ...patch,
    metadata: { hecom_cliente_id: ids.client, source: "dashboard", input_mode: "desired_credit",
      ledger_journal_id: ids.journal, wallet_credit_currency: "USD", credit_amount_cents: 10000,
      fee_amount_cents: 1300, gross_amount_cents: 11300, fee_percent: 13,
      fee_holistic_percent: 10, fee_stripe_surcharge_percent: 3, ...meta } };
}
function journal(patch = {}) {
  return { id: ids.journal, source_table: "payment_intents", source_id: ids.payment, organization_id: ids.org,
    wallet_id: ids.wallet, journal_type: "deposit_confirmed", status: "posted", amount_cents: 10000,
    currency: "USD", posted_at: "2026-09-03T12:01:00Z", reversal_of_journal_id: null, reversed_by_journal_id: null, ...patch };
}
function mockDb(payments = [payment()], journals = [journal()], errors = {}) {
  const calls = [];
  return { calls, from(table) {
    const chain = {};
    for (const method of ["select", "eq", "or", "order", "limit", "in", "abortSignal"]) chain[method] = (...args) => {
      calls.push({ table, method, args }); return chain;
    };
    chain.then = (resolve, reject) => Promise.resolve({ data: table === "payment_intents" ? payments : journals, error: errors[table] ?? null }).then(resolve, reject);
    return chain;
  } };
}
function req(query = {}, auth = "Bearer test-secret") {
  const params = new URLSearchParams({ clientId: ids.client, receiptDate: "2026-09-03", ...query });
  return new Request(`https://example.test/api/internal/hecom/payment-detail?${params}`, { headers: { authorization: auth } });
}
async function read(db = mockDb(), request = req({ paymentId: ids.payment })) {
  const response = await handleHecomPaymentDetail(request, { secret: "test-secret", createAdmin: () => db });
  return { response, body: await response.json(), calls: db.calls };
}

test("requires configured bridge and matching bearer before creating admin client", async () => {
  let creates = 0;
  for (const [secret, header, expected] of [["", "Bearer test-secret", 503], ["test-secret", "Bearer wrong", 401], ["test-secret", "", 401]]) {
    const response = await handleHecomPaymentDetail(req({}, header), { secret, createAdmin: () => { creates++; throw Error("unexpected"); } });
    assert.equal(response.status, expected); assert.equal(response.headers.get("cache-control"), "no-store, private");
    assert.equal((await response.text()).includes("test-secret"), false);
  }
  assert.equal(creates, 0);
});

test("rejects invalid UUID, dates, duplicate and unknown query fields without reading DB", async () => {
  for (const query of [{ clientId: "someone@example.com" }, { paymentId: "pi_stripe" }, { receiptDate: "2026-02-30" }, { receiptDate: "2026-13-01" }, { email: "x" }]) {
    const result = await read(mockDb(), req(query)); assert.equal(result.response.status, 400); assert.equal(result.calls.length, 0);
  }
  const request = req(); const duplicate = new Request(`${request.url}&clientId=${ids.other}`, { headers: request.headers });
  assert.equal((await read(mockDb(), duplicate)).response.status, 400);
});

test("exact payment binds database query and returned data to the Hecom client", async () => {
  const result = await read();
  assert.equal(result.body.payments[0].relationship, "exact_payment");
  assert.ok(result.calls.some(c => c.table === "payment_intents" && c.method === "eq" && c.args[0] === "metadata->>hecom_cliente_id" && c.args[1] === ids.client));
  assert.ok(result.calls.some(c => c.method === "eq" && c.args[0] === "id" && c.args[1] === ids.payment));
  for (const row of [payment({}, { hecom_cliente_id: ids.other }), payment({ id: ids.other })]) {
    const isolated = await read(mockDb([row]));
    assert.equal(isolated.response.status, 200); assert.deepEqual(isolated.body.payments, []);
    assert.equal(isolated.calls.some(c => c.table === "ledger_journals"), false);
  }
});

test("original quote and exact posted wallet credit are separate from a TikTok assignment", async () => {
  const { body } = await read(); const row = body.payments[0];
  assert.equal(row.funding.mode, "wallet_topup"); assert.equal(row.funding.wallet_credit_cents, 10000);
  assert.equal(row.funding.holistic_fee_cents, 1000); assert.equal(row.funding.gateway_surcharge_cents, 300);
  assert.equal(row.wallet_credit.verified, true); assert.equal(row.wallet_credit.amount_cents, 10000);
  assert.equal(row.original.fx_rate_usd_pen, null);
});

test("journal ownership, source, posting and reversal all gate confirmed wallet credit", async () => {
  for (const patch of [{ organization_id: ids.other }, { wallet_id: ids.other }, { source_table: "other" },
    { journal_type: "allocation" }, { status: "draft" }, { reversed_by_journal_id: ids.other },
    { reversal_of_journal_id: ids.other }, { source_id: ids.other }]) {
    const { body } = await read(mockDb([payment()], [journal(patch)]));
    assert.equal(body.payments[0].wallet_credit.verified, false);
    assert.notEqual(body.payments[0].funding?.mode, "wallet_topup");
  }
  assert.equal((await read(mockDb([payment()], [journal(), journal({ id: ids.other })]))).body.payments[0].wallet_credit.verified, false);
});

test("disagreed journal amount does not present the quote as a verified allocation", async () => {
  const row = (await read(mockDb([payment()], [journal({ amount_cents: 9000 })]))).body.payments[0];
  assert.equal(row.wallet_credit.verified, true); assert.equal(row.wallet_credit.amount_cents, 9000);
  assert.equal(row.funding.mode, "unknown"); assert.equal(row.funding.unclassified_cents, 11300);
});

test("pending intent cannot claim a credited wallet even with a journal", async () => {
  const row = (await read(mockDb([payment({ status: "pending" })]))).body.payments[0];
  assert.equal(row.funding, null); assert.equal(row.wallet_credit.verified, false);
});

test("month query uses paid date or created fallback in Lima and reports truncation", async () => {
  const payments = Array.from({ length: 101 }, (_, i) => payment({ id: `00000000-0000-4000-8000-${String(i + 100).padStart(12, "0")}` }));
  const { body, calls } = await read(mockDb(payments, []), req());
  assert.equal(body.payments.length, 100); assert.equal(body.coverage.complete, false); assert.equal(body.coverage.hasMore, true);
  assert.equal(body.payments[0].relationship, "same_client_month");
  const range = calls.find(c => c.method === "or").args[0];
  assert.match(range, /succeeded_at\.gte\.2026-09-01T05:00:00\.000Z/);
  assert.match(range, /succeeded_at\.is\.null,created_at\.gte/);
  assert.match(range, /2026-10-01T05:00:00\.000Z/);
  assert.ok(calls.some(c => c.table === "payment_intents" && c.method === "limit" && c.args[0] === 101));
});

test("month without results means this scope was checked, not no historical recharge", async () => {
  const { body } = await read(mockDb([], []), req());
  assert.equal(body.coverage.mode, "client_month"); assert.equal(body.coverage.month, "2026-09");
  assert.equal(body.coverage.complete, true); assert.deepEqual(body.payments, []);
});

test("whitelist excludes metadata, PII, attachments, checkout secrets and internal ownership", async () => {
  const unsafe = payment({ checkout_url: "https://secret", created_by: ids.other, private: "no" }, {
    email: "private@example.com", receipt_url: "https://secret", secret_token: "never", fx_rate_usd_pen: 3.4,
    source: "free text private@example.com" });
  const { body } = await read(mockDb([unsafe]));
  const row = body.payments[0], serial = JSON.stringify(body);
  for (const value of ["private@example.com", "https://secret", "never", "organization_id", "wallet_id", "created_by", "metadata"]) assert.equal(serial.includes(value), false);
  assert.equal(row.original.fx_rate_usd_pen, 3.4); assert.equal(row.funding.source, null);
});

test("ledger failure is explicit without discarding safe payment data or leaking errors", async () => {
  const { body } = await read(mockDb([payment()], [], { ledger_journals: { message: "secret detail" } }));
  assert.equal(body.coverage.journalsComplete, false); assert.equal(body.payments.length, 1);
  assert.equal(body.payments[0].wallet_credit.status, "unavailable");
  assert.equal(JSON.stringify(body).includes("secret detail"), false);
});

test("payment source failure is not an empty successful history", async () => {
  const { response, body } = await read(mockDb([], [], { payment_intents: { message: "raw database error" } }));
  assert.equal(response.status, 502); assert.equal(body.error, "payment_source_unavailable");
  assert.equal(JSON.stringify(body).includes("raw database"), false);
});

test("payment detail exposes proof availability without signing, file paths or filenames", async () => {
  const privatePath = `${ids.org}/${ids.payment}/123-private-file.png`;
  const row = payment({}, { manual_proof: { bucket: "payment-proofs", path: privatePath,
    mime_type: "image/png", size_bytes: 100, file_name: "private-file.png" } });
  const { body } = await read(mockDb([row]));
  assert.equal(body.payments[0].proofAvailable, true); assert.equal(body.payments[0].proofKind, "image");
  assert.equal(JSON.stringify(body).includes("private-file"), false);
  const absent = (await read()).body.payments[0];
  assert.equal(absent.proofAvailable, false); assert.equal(absent.proofKind, null);
});
