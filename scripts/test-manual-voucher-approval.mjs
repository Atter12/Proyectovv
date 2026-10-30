import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(path, mocks = {}, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, Buffer, console, AbortSignal,
    require: (id) => {
      if (id === "server-only") return {};
      if (id in mocks) return mocks[id];
      if (id.startsWith("node:")) return require(id);
      throw new Error(`Unexpected dependency ${id}`);
    }, ...globals,
  });
  return mod.exports;
}
const destination = load("lib/payments/voucher-destination.ts");
const accounts = [{ holder: "HOLISTIC MARKETING LLC", holderAliases: ["Holistic Marketing Pe E.", "Holistic Marketing Pe Eirl"], accountNumber: "1947376966005", cci: "00219400737696600598" }];
const valid = { amount: 100, currency: "PEN", operation_code: "123456", confidence: 0.99, destination_account: accounts[0].accountNumber, beneficiary_name: accounts[0].holder, is_payment_receipt: true, payment_completed: true, visible_manipulation: false, visual_assessment: "clear", visual_findings: [], critical_fields_readable: true };
async function analyze(overrides = {}, env = {}, formatPassed = true) {
  const service = load("lib/payments/voucher-analysis.server.ts", {
    "./voucher-destination": destination,
    "./voucher-format-review.server": { reviewVoucherFormat: async () => ({ passed: formatPassed, profile: "bcp_app", outcome: formatPassed ? "compatible" : "unsupported", observedLabels: [], findings: [] }) },
    "@/lib/env/env.server": { serverEnv: { openAiApiKey: "test", ...env } },
    "@/lib/payments/voucher-channel": { normalizeVoucherBank: () => null, normalizeVoucherChannel: () => "transferencia" },
  }, { fetch: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ ...valid, ...overrides }) } }] }) }) });
  return service.analyzePaymentVoucher({ buffer: Buffer.from("test"), mimeType: "image/png", expectedAmount: 100, expectedCurrency: "PEN", strictCurrency: true, destinationAccounts: accounts });
}

test("complete account or CCI and normalized holder are accepted", async () => {
  assert.equal((await analyze()).confirmed, true);
  assert.equal((await analyze({ destination_account: accounts[0].cci, beneficiary_name: "Holistic Marketing L.L.C." })).confirmed, true);
});
test("independent format review blocks an otherwise clear receipt", async () => {
  const result = await analyze({}, {}, false);
  assert.equal(result.confirmed, false);
  assert.equal(result.receiptScreeningPassed, false);
});
test("supported format requires literal labels and a consistent assessment", () => {
  const { evaluateVoucherFormat } = load("lib/payments/voucher-format-review.server.ts", { "@/lib/env/env.server": { serverEnv: {} } });
  const good = { profile: "bcp_app", outcome: "compatible", observed_labels: ["Enviado a", "Desde", "Número de operación"], findings: [] };
  assert.equal(evaluateVoucherFormat(good).passed, true);
  assert.equal(evaluateVoucherFormat({ ...good, profile: "interbank_receipt" }).profile, "bcp_app");
  assert.equal(evaluateVoucherFormat({ ...good, profile: "interbank_receipt", observed_labels: ["Cuenta destino:", "Cuenta cargo:", "Código de operación:"] }).passed, true);
  assert.equal(evaluateVoucherFormat({ ...good, observed_labels: [...good.observed_labels, "Cuenta destino", "Cuenta cargo", "Código de operación"] }).passed, false);
  for (const patch of [{ profile: "unknown" }, { outcome: "suspicious" }, { observed_labels: ["Destinatario", "Desde", "Número de operación"] }, { findings: ["Montaje"] }, { findings: null }]) {
    assert.equal(evaluateVoucherFormat({ ...good, ...patch }).passed, false);
  }
});
test("wrong, absent or cross-paired destinations are rejected", async () => {
  for (const patch of [{ destination_account: "1947376966006" }, { destination_account: "***6006" }, { destination_account: null }, { beneficiary_name: null }, { beneficiary_name: "HOLISTIC" }, { beneficiary_name: "Another company" }]) {
    assert.equal((await analyze(patch)).confirmed, false, JSON.stringify(patch));
  }
  assert.equal(destination.matchesVoucherDestination(accounts[0].accountNumber, "Other", [...accounts, { holder: "Other", accountNumber: "123456789" }]), false);
});
test("recipient row wins over an OCR copy of the sender row; no missing recipient is invented", async () => {
  const result = await analyze({ destination_account: "**** 9876", source_block: { label: "Desde", account: "**** 9876" }, destination_block: { label: "Enviado a", account: "**** 6005", holder: "Holistic Marketing Pe E." } });
  assert.equal(result.confirmed, true);
  assert.equal(result.destinationAccount, "**** 6005");
  assert.equal(result.sourceAccount, "**** 9876");
  for (const destination_block of [null, { label: "Desde", account: accounts[0].accountNumber, holder: accounts[0].holder }, { label: "Cuenta de destino", account: accounts[0].cci, holder: null }]) {
    assert.equal((await analyze({ destination_block })).confirmed, false);
  }
});
test("approved business receipt variant preserves request identifier and requires final success", async () => {
  const { evaluateVoucherFormat } = load("lib/payments/voucher-format-review.server.ts", { "@/lib/env/env.server": { serverEnv: {} } });
  const observed_labels = ["Cuenta de cargo", "Cuenta de destino", "Número de solicitud", "Fecha y hora de operación", "Transferencia exitosa"];
  assert.equal(evaluateVoucherFormat({ profile: "interbank_receipt", outcome: "compatible", observed_labels, findings: [] }).passed, true);
  assert.equal(evaluateVoucherFormat({ profile: "interbank_receipt", outcome: "compatible", observed_labels: observed_labels.slice(0, -1), findings: [] }).passed, false);
  const result = await analyze({ operation_label: "Número de solicitud" });
  assert.equal(result.operationLabel, "Número de solicitud");
  assert.equal((await analyze({ operation_label: "Número de solicitud", payment_completed: false })).confirmed, false);
});
test("historical BCP masking and explicit recipient aliases are recognized", async () => {
  for (const number of ["**** 6005", "194-***-6005", "••••6005"]) {
    assert.equal((await analyze({ destination_account: number, beneficiary_name: "Holistic Marketing Pe E." })).confirmed, true);
  }
  assert.equal((await analyze({ destination_account: accounts[0].cci, beneficiary_name: "Holistic Marketing Pe Eirl" })).confirmed, true);
});
test("short suffixes, missing mask, contradictory prefixes and ambiguous destinations fail closed", async () => {
  for (const number of ["6005", "***005", "999***6005", "194737696600X", "ilegible 6005"]) {
    assert.equal((await analyze({ destination_account: number })).confirmed, false, number);
  }
  assert.equal(destination.matchesVoucherDestination("****6005", accounts[0].holder, [...accounts, { holder: "Someone else", accountNumber: "9999999996005" }]), false);
  assert.equal(destination.matchesVoucherDestination("****6005", "Holistic Marketing Pe E.", [{ ...accounts[0], holderAliases: [] }]), false);
});
test("source debit is separate from transfer amount; destination currency contradictions stay in review", async () => {
  const good = await analyze({ debited_amount: 27, debited_currency: "USD", destination_currency_text: "Moneda Soles" });
  assert.equal(good.detectedAmount, 100);
  assert.equal(good.debitedAmount, 27);
  assert.equal(good.confirmed, true);
  const conflict = await analyze({ destination_currency_text: "Moneda Dólares" });
  assert.equal(conflict.currencyConsistent, false);
  assert.equal(conflict.confirmed, false);
  const inferred = await analyze({ destination_currency: "USD", destination_currency_text: null });
  assert.equal(inferred.destinationCurrency, null);
  assert.equal(inferred.confirmed, true);
});
test("amount, currency, operation and confidence must be explicit and correct", async () => {
  for (const patch of [{ amount: 99.99 }, { amount: 0 }, { currency: "USD" }, { currency: null }, { operation_code: null }, { confidence: 0.5 }]) {
    assert.equal((await analyze(patch)).confirmed, false, JSON.stringify(patch));
  }
});
test("trust-upload cannot bypass destination verification when AI is unavailable", async () => {
  assert.equal((await analyze({}, { openAiApiKey: "", manualVoucherTrustUpload: true })).confirmed, false);
});
test("memes, unrelated photos, pending transfers and suspected edits cannot credit", async () => {
  for (const patch of [{ is_payment_receipt: false }, { is_payment_receipt: null }, { payment_completed: false }, { payment_completed: null }, { visible_manipulation: true }, { visible_manipulation: null }, { visible_manipulation: undefined }]) {
    const result = await analyze(patch);
    assert.equal(result.confirmed, false, JSON.stringify(patch));
    assert.equal(result.receiptScreeningPassed, false);
  }
});
test("visual screening distinguishes clear evidence from suspicion, unreadability and malformed responses", async () => {
  for (const patch of [
    { visual_assessment: "suspicious", visual_findings: ["Monto sobre un recuadro de otro color"] },
    { visual_assessment: "unreadable" }, { visual_assessment: "not_receipt" },
    { visual_assessment: undefined }, { visual_assessment: "authentic" },
    { visual_findings: ["Receptor sobrepuesto"] }, { visual_findings: null }, { visual_findings: "none" },
    { visual_findings: [123] }, { critical_fields_readable: false }, { critical_fields_readable: undefined },
  ]) {
    const result = await analyze(patch);
    assert.equal(result.receiptScreeningPassed, false, JSON.stringify(patch));
    assert.equal(result.confirmed, false);
  }
  const clear = await analyze();
  assert.equal(clear.visualAssessment, "clear");
  assert.equal(clear.confirmed, true);
});

function completion({ metadata = {}, duplicate = false, checkFailed = false, status = "processing" } = {}) {
  let credits = 0;
  const intent = { id: "test", organizationId: "org", provider: "manual", amountCents: 100000, status, metadata: {
    source: "dashboard", voucher_approval_policy: "destination_v1", credit_amount_cents: 100000,
    voucher_content_hash: "hash", voucher_operation_code: "123456",
    voucher_analysis: { confirmed: true, destinationVerified: true, accountMatch: true, beneficiaryMatch: true, analysisMode: "openai_vision", receiptScreeningPassed: true },
    voucher_security: { duplicateContentHash: false, duplicateOperationCode: false, duplicateCheckFailed: false, rateLimitBlocksAutoApprove: false }, ...metadata,
  } };
  const service = load("lib/payments/manual-bank-match/confirm-deposit.server.ts", {
    "@/lib/ledger/ledger.server": { confirmDepositInLedger: async () => { credits++; return "journal"; } },
    "@/lib/payments/payment-intents.server": { getPaymentIntentByIdInternal: async () => intent, updatePaymentIntentRecord: async (_, patch) => Object.assign(intent, patch) },
    "@/lib/notifications/create-notification.server": { createNotificationBestEffort: async () => {} },
    "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => ({ insert: async () => ({}) }) }) },
    "@/lib/records": { isRecord: (x) => !!x && typeof x === "object", getString: (x) => typeof x === "string" ? x : null, mergeMetadata: (a, b) => ({ ...a, ...b }) },
    "@/lib/hecom/ensure-wallet-cobro.server": { ensureHecomWalletCobroSyncedBestEffort: async () => {} },
    "./source": { MANUAL_DASHBOARD_SOURCE: "dashboard" },
    "@/lib/payments/missing-cobro.shared": { isMissingCobroPurpose: (m) => m.purpose === "missing", isLoPagadoDebtPurpose: (m) => m.purpose === "debt" },
    "@/lib/payments/voucher-security.server": { checkDuplicateVoucherHash: async () => ({ duplicate, checkFailed }), checkDuplicateOperationCode: async () => ({ duplicate, checkFailed }) },
    "@/lib/payments/auto-approve-limit.server": { exceedsAutoApproveLimit: () => { throw new Error("Voucher policy must not require manager by amount"); } },
  });
  return { service, intent, credits: () => credits };
}
test("credits without bank mail or manager even above old limit; retry does not credit twice", async () => {
  const fixture = completion();
  assert.equal((await fixture.service.completeManualVoucherConfirmedDeposit({ intentId: "test" })).completed, true);
  assert.equal(fixture.intent.metadata.approval_source, "voucher_destination");
  await fixture.service.completeManualVoucherConfirmedDeposit({ intentId: "test" });
  assert.equal(fixture.credits(), 1);
});
test("duplicate, failed checks, invalid analysis, debt and closed intents never credit", async () => {
  for (const options of [{ duplicate: true }, { checkFailed: true }, { metadata: { voucher_analysis: { confirmed: true } } }, { metadata: { purpose: "missing" } }, { metadata: { purpose: "debt" } }, { metadata: { skip_wallet_credit: true } }, { status: "cancelled" }]) {
    const fixture = completion(options);
    assert.equal((await fixture.service.completeManualVoucherConfirmedDeposit({ intentId: "test" })).completed, false);
    assert.equal(fixture.credits(), 0);
  }
});
test("late bank mail cannot bypass destination policy", async () => {
  const fixture = completion({ metadata: { voucher_analysis: { confirmed: true } } });
  assert.equal((await fixture.service.completeManualBankConfirmedDeposit({ intentId: "test", notificationId: "mail", operationNumber: "123456" })).completed, false);
  assert.equal(fixture.credits(), 0);
});

test("upload persists verified proof and immediately credits without accessing mailbox", async () => {
  const fixture = completion();
  let analysisInput;
  const service = load("lib/payments/process-manual-voucher.server.ts", {
    "@/lib/payments/payment-intents.server": { getPaymentIntentByIdInternal: async () => fixture.intent, updatePaymentIntentRecord: async (_, patch) => Object.assign(fixture.intent, patch) },
    "@/lib/notifications/create-notification.server": { createNotificationBestEffort: async () => { throw new Error("Valid upload should credit immediately"); } },
    "@/lib/records": { mergeMetadata: (a, b) => ({ ...a, ...b }) },
    "@/lib/payments/voucher-analysis.server": { hashVoucherBuffer: () => "hash", analyzePaymentVoucher: async (input) => { analysisInput = input; return { ...fixture.intent.metadata.voucher_analysis, operationCode: "123456" }; } },
    "@/lib/payments/voucher-security.server": {
      checkVoucherUploadRateLimits: async () => ({ uploadAllowed: true, autoApproveAllowed: true }),
      checkDuplicateVoucherHash: async () => ({ duplicate: false, checkFailed: false }),
      checkDuplicateOperationCode: async () => ({ duplicate: false, checkFailed: false }),
      normalizeOperationCode: (value) => value ?? null,
    },
    "@/lib/payments/manual-bank-accounts.server": { getManualBankAccounts: () => accounts },
    "@/lib/payments/gateway-config": { isGatewayInMaintenance: () => false },
    "@/lib/payments/manual-bank-match/confirm-deposit.server": fixture.service,
    "@/lib/payments/manual-bank-match/source": { MANUAL_DASHBOARD_SOURCE: "dashboard" },
    "@/lib/payments/missing-cobro.shared": { isMissingCobroPurpose: () => false, isLoPagadoDebtPurpose: () => false },
  });
  const result = await service.processManualVoucherUpload({ paymentIntentId: "test", organizationId: "org", buffer: Buffer.from("test"), mimeType: "image/png", fileName: "proof.png", storagePath: "proof.png", submittedBy: "user" });
  assert.equal(result.autoApproved, true);
  assert.equal(result.status, "succeeded");
  assert.equal(fixture.credits(), 1);
  assert.equal(analysisInput.strictCurrency, true);
  assert.equal(analysisInput.destinationAccounts, accounts);
});
