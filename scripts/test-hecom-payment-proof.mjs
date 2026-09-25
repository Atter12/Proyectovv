import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { paymentProofReference, validSignedPaymentProofUrl } from "../lib/hecom/payment-proof.ts";
import { buildWalletFunding } from "../lib/hecom/wallet-funding.ts";

const require = createRequire(import.meta.url), ts = require("typescript");
function load(path, mocks) {
  const text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, Request, Response, URL, AbortSignal, Buffer,
    require: key => key === "server-only" ? {} : key in mocks ? mocks[key] : require(key) });
  return mod.exports;
}
const detail = load("lib/hecom/payment-detail.server.ts", { "@/lib/hecom/wallet-funding": { buildWalletFunding },
  "@/lib/hecom/payment-proof": { paymentProofReference } });
const proofModule = load("lib/hecom/payment-proof.server.ts", { "@/lib/hecom/payment-detail.server": detail,
  "@/lib/hecom/payment-proof": { paymentProofReference, validSignedPaymentProofUrl } });
const ids = { client: "00000000-0000-4000-8000-000000000001", payment: "00000000-0000-4000-8000-000000000002",
  org: "00000000-0000-4000-8000-000000000003", other: "00000000-0000-4000-8000-000000000004" };
const origin = "https://synthetic.supabase.co", path = `${ids.org}/${ids.payment}/123-voucher.png`;
const signedUrl = `${origin}/storage/v1/object/sign/payment-proofs/${path}?token=synthetic-test`;
function payment(proof = {}, patch = {}) {
  return { id: ids.payment, organization_id: ids.org, ...patch, metadata: { hecom_cliente_id: ids.client,
    manual_proof: { bucket: "payment-proofs", path, mime_type: "image/png", size_bytes: 512, ...proof }, ...(patch.metadata ?? {}) } };
}
function request(query = {}, auth = "Bearer test-secret") {
  const params = new URLSearchParams({ clientId: ids.client, paymentId: ids.payment, receiptDate: "2026-09-25", ...query });
  return new Request(`https://synthetic.test/api/internal/hecom/payment-proof?${params}`, { headers: { authorization: auth } });
}
function db(row = payment(), { dbError = null, storageError = null, url = signedUrl } = {}) {
  const calls = [];
  const chain = {};
  for (const method of ["select", "eq", "limit", "abortSignal", "maybeSingle"]) chain[method] = (...args) => {
    calls.push({ method, args }); return chain;
  };
  chain.then = (resolve, reject) => Promise.resolve({ data: row, error: dbError }).then(resolve, reject);
  return { calls, from(table) { calls.push({ method: "from", args: [table] }); return chain; }, storage: {
    from(bucket) { calls.push({ method: "storage.from", args: [bucket] }); return {
      async createSignedUrl(...args) { calls.push({ method: "createSignedUrl", args }); return { data: { signedUrl: url }, error: storageError }; },
    }; },
  } };
}
async function read(database = db(), req = request()) {
  const response = await proofModule.handleHecomPaymentProof(req, { secret: "test-secret", supabaseUrl: origin, createAdmin: () => database });
  return { response, body: await response.json(), calls: database.calls };
}

for (const [name, proof, patch] of [
  ["different organization prefix", { path: `${ids.other}/${ids.payment}/1.png` }],
  ["different payment prefix", { path: `${ids.org}/${ids.other}/1.png` }],
  ["parent traversal", { path: `${ids.org}/${ids.payment}/../other.png` }],
  ["encoded traversal", { path: `${ids.org}/${ids.payment}/%2e%2e%2fother.png` }],
  ["absolute storage path", { path: `/${path}` }],
  ["URL instead of object path", { path: `https://evil.test/${path}` }],
  ["backslash traversal", { path: `${ids.org}/${ids.payment}/..\\other.png` }],
  ["nested filename directory", { path: `${ids.org}/${ids.payment}/nested/1.png` }],
  ["different bucket", { bucket: "comprobantes" }],
  ["oversized proof", { size_bytes: 10 * 1024 * 1024 + 1 }],
  ["invalid negative size", { size_bytes: -1 }],
  ["untrusted size type", { size_bytes: "512" }],
  ["empty filename", { path: `${ids.org}/${ids.payment}/` }],
  ["unsafe filename characters", { path: `${ids.org}/${ids.payment}/<script>.png` }],
  ["invalid owning UUID", {}, { organization_id: "unknown" }],
]) test(`does not expose or sign ${name}`, async () => {
  const row = payment(proof, patch); assert.equal(paymentProofReference(row), null);
  const { body, calls } = await read(db(row)); assert.equal(body.error, "proof_not_found");
  assert.equal(calls.some(c => c.method === "createSignedUrl"), false);
});

for (const [name, value] of [
  ["foreign origin", signedUrl.replace(origin, "https://evil.test")],
  ["unencrypted URL", signedUrl.replace("https:", "http:")],
  ["foreign object", signedUrl.replace("123-voucher.png", "other.png")],
  ["foreign bucket", signedUrl.replace("payment-proofs", "comprobantes")],
  ["public URL", signedUrl.replace("/object/sign/", "/object/public/")],
  ["missing token", signedUrl.split("?")[0]],
  ["duplicate token", `${signedUrl}&token=another`],
  ["unexpected query", `${signedUrl}&redirect=https://evil.test`],
  ["URL credentials", signedUrl.replace("https://", "https://user:pass@")],
  ["URL fragment", `${signedUrl}#fragment`],
]) test(`rejects signer response with ${name}`, async () => {
  assert.equal(validSignedPaymentProofUrl(value, origin, path), false);
  const { response, body } = await read(db(payment(), { url: value }));
  assert.equal(response.status, 502); assert.equal(body.error, "proof_unavailable"); assert.equal("url" in body, false);
});

test("missing or incorrect secret never creates admin nor accesses storage", async () => {
  let creates = 0;
  for (const [secret, auth, expected] of [["", "Bearer test-secret", 503], ["test-secret", "Bearer wrong", 401]]) {
    const response = await proofModule.handleHecomPaymentProof(request({}, auth), { secret, supabaseUrl: origin, createAdmin: () => { creates++; } });
    assert.equal(response.status, expected);
  }
  assert.equal(creates, 0);
});
test("requires exact payment ID and strict date; caller cannot provide a path", async () => {
  for (const query of [{ paymentId: "" }, { receiptDate: "2026-02-30" }, { path }, { clientId: "email@example.com" }]) {
    const result = await read(db(), request(query)); assert.equal(result.response.status, 400); assert.equal(result.calls.length, 0);
  }
});
test("unknown and cross-client payments return the same response without signing", async () => {
  for (const row of [null, payment({}, { id: ids.other }), payment({}, { metadata: { hecom_cliente_id: ids.other } })]) {
    const { response, body, calls } = await read(db(row));
    assert.equal(response.status, 404); assert.equal(body.error, "proof_not_found");
    assert.equal(calls.some(c => c.method === "createSignedUrl"), false);
  }
});
test("reads exact owner and signs original object for five minutes without copying", async () => {
  const { response, body, calls } = await read();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.deepEqual(body, { ok: true, url: signedUrl, expiresIn: 300, previewKind: "image" });
  assert.ok(calls.some(c => c.method === "eq" && c.args[0] === "id" && c.args[1] === ids.payment));
  assert.ok(calls.some(c => c.method === "eq" && c.args[0] === "metadata->>hecom_cliente_id" && c.args[1] === ids.client));
  const sign = calls.find(c => c.method === "createSignedUrl"); assert.deepEqual([...sign.args], [path, 300]);
  assert.equal(calls.some(c => ["upload", "insert", "update"].includes(c.method)), false);
});
test("absent voucher metadata is an explicit missing proof", async () => {
  const row = payment({}, { metadata: { manual_proof: null } });
  assert.equal(paymentProofReference(row), null); assert.equal((await read(db(row))).response.status, 404);
});
test("legacy storage_path and missing bucket/size still bind original object", () => {
  const reference = paymentProofReference(payment({ path: undefined, storage_path: path, bucket: undefined, size_bytes: undefined }));
  assert.equal(reference?.path, path); assert.equal(reference?.kind, "image");
});
test("unsafe image types are file-only and PDF is classified explicitly", () => {
  assert.equal(paymentProofReference(payment({ path: path.replace("png", "svg"), mime_type: "image/svg+xml" }))?.kind, "file");
  assert.equal(paymentProofReference(payment({ path: path.replace("png", "pdf"), mime_type: "application/pdf" }))?.kind, "pdf");
  assert.equal(paymentProofReference(payment({ mime_type: "text/html" }))?.kind, "file");
});
test("source and signing failures return generic errors without URLs or details", async () => {
  for (const options of [{ dbError: { message: "private" } }, { storageError: { message: "private" } }]) {
    const { response, body } = await read(db(payment(), options)); assert.equal(response.status, 502);
    assert.equal(JSON.stringify(body).includes("private"), false); assert.equal("url" in body, false);
  }
});
test("Next route uses existing server-only bridge secret and original Supabase configuration", async () => {
  const database = db();
  const route = load("app/api/internal/hecom/payment-proof/route.ts", {
    "@/lib/env/env.server": { serverEnv: { hecomCobrosBridgeSecret: "test-secret", supabaseUrl: origin } },
    "@/lib/supabase/admin": { createAdminClient: () => database },
    "@/lib/hecom/payment-proof.server": proofModule,
  });
  assert.equal((await route.GET(request({}, "Bearer wrong"))).status, 401);
  assert.equal(database.calls.length, 0);
  const response = await route.GET(request()); assert.equal(response.status, 200);
});
