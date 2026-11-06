import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { toRechargeRow } from "./my-recharges.shared.ts";
import { depositFromDesiredCredit, effectiveDepositFeePercent, normalizeFeePercent, DEFAULT_DEPOSIT_FEE_PERCENT } from "./deposit-fee.ts";

function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, Date, console, require: (name) => mocks[name] ?? {} });
  return exports;
}
const records = { isRecord: (v) => v !== null && typeof v === "object",
  getString: (v) => typeof v === "string" ? v : null,
  mergeMetadata: (a, b) => ({ ...a, ...b }) };

test("Binance cannot auto-credit from either a receipt or a late bank notification", async () => {
  for (const marker of [{ manual_pay_method: "binance" }, { manual_manager_approval_required: true },
    { voucher_analysis: { confirmed: true, paymentChannel: "binance" } }]) {
    const api = load("./manual-bank-match/confirm-deposit.server.ts", {
      "@/lib/records": records,
      "./source": { MANUAL_DASHBOARD_SOURCE: "dashboard" },
      "@/lib/payments/payment-intents.server": { getPaymentIntentByIdInternal: async () => ({
        id: "test", provider: "manual", status: "processing", metadata: { source: "dashboard", ...marker },
      }) },
      "@/lib/payments/missing-cobro.shared": { isMissingCobroPurpose: () => false, isLoPagadoDebtPurpose: () => false },
      "@/lib/ledger/ledger.server": { confirmDepositInLedger: () => { throw new Error("Must not credit"); } },
    });
    for (const result of [await api.completeManualVoucherConfirmedDeposit({ intentId: "test" }),
      await api.completeManualBankConfirmedDeposit({ intentId: "test", notificationId: "late", operationNumber: "123" })]) {
      assert.equal(result.completed, false);
      assert.match(result.reason, /gerencia/);
    }
  }
});

test("a Binance upload saves proof and reaches manager review even if AI says confirmed", async () => {
  const intent = { id: "test", organizationId: "org", provider: "manual", status: "requires_payment",
    amountCents: 22000, metadata: { source: "dashboard", manual_pay_method: "binance", charge_currency: "USD", credit_amount_cents: 20000 } };
  let managerNotifications = 0;
  const api = load("./process-manual-voucher.server.ts", {
    "@/lib/records": records,
    "@/lib/payments/payment-intents.server": {
      getPaymentIntentByIdInternal: async () => intent,
      updatePaymentIntentRecord: async (_id, patch) => Object.assign(intent, patch),
    },
    "@/lib/notifications/create-notification.server": { createNotificationBestEffort: async () => {} },
    "@/lib/payments/voucher-analysis.server": { hashVoucherBuffer: () => "hash",
      analyzePaymentVoucher: async () => ({ confirmed: true, needsReview: false, paymentChannel: "binance", operationCode: "123" }) },
    "@/lib/payments/voucher-security.server": {
      checkVoucherUploadRateLimits: async () => ({ uploadAllowed: true, autoApproveAllowed: true }),
      checkDuplicateVoucherHash: async () => ({ duplicate: false, checkFailed: false }),
      checkDuplicateOperationCode: async () => ({ duplicate: false, checkFailed: false }),
      normalizeOperationCode: (v) => v,
    },
    "@/lib/payments/manual-bank-accounts.server": { getManualBankAccounts: () => [] },
    "@/lib/payments/gateway-config": { isGatewayInMaintenance: () => false },
    "@/lib/payments/manual-bank-match/confirm-deposit.server": {
      completeManualVoucherConfirmedDeposit: () => { throw new Error("Must not auto-approve"); },
    },
    "@/lib/payments/manual-bank-match/source": { MANUAL_DASHBOARD_SOURCE: "dashboard" },
    "@/lib/payments/missing-cobro.shared": { isMissingCobroPurpose: () => false, isLoPagadoDebtPurpose: () => false },
    "@/lib/email/manual-payment-notify.server": { notifyManagersManualPaymentPendingBestEffort: async () => { managerNotifications++; } },
  });
  const result = await api.processManualVoucherUpload({ paymentIntentId: "test", organizationId: "org",
    buffer: Buffer.from("test"), mimeType: "image/png", fileName: "proof.png", storagePath: "org/test/proof.png", submittedBy: "user" });
  assert.equal(result.autoApproved, false);
  assert.equal(intent.status, "processing");
  assert.equal(intent.metadata.manual_review_status, "pending_review");
  assert.equal(intent.metadata.manual_proof.path, "org/test/proof.png");
  assert.equal(managerNotifications, 1);
});

test("resuming a manual Binance request preserves its payment method", () => {
  const row = toRechargeRow({ id: "test", created_at: "2026-11-05", provider: "manual",
    status: "requires_payment", amount_cents: 22000, currency: "USD", metadata: { manual_pay_method: "binance" } });
  assert.equal(row.manualPayMethod, "binance");
  assert.equal(row.state, "needs_proof");
});

for (const agreedFee of [0, 3, 7, 10]) {
test(`Binance respects the agreed ${agreedFee}% fee and keeps manager approval`, async () => {
  let saved;
  const query = { select() { return this; }, eq() { return this; }, limit() { return this; },
    maybeSingle: async () => ({ data: { id: "wallet" }, error: null }) };
  const api = load("./create-intent.server.ts", {
    "@/types/payment": { isPaymentGatewayId: () => true, isVoucherPaymentProvider: () => true },
    "@/lib/payments/gateway-config": { isGatewayInMaintenance: () => false },
    "@/lib/payments/providers": { getPaymentProvider: () => ({ isConfigured: () => true,
      createCheckout: async () => ({ status: "requires_payment", checkoutUrl: null, providerReference: null }) }) },
    "@/lib/payments/resolve-hecom-deposit-fee.server": { resolveDepositFeeForSession: async () => ({
      feePercent: agreedFee, hecomClienteId: "client", hecomClienteName: "Test", feeSource: "test",
    }) },
    "@/lib/payments/deposit-fee": { depositFromDesiredCredit, effectiveDepositFeePercent },
    "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => query }) },
    "@/lib/payments/payment-intents.server": {
      createPaymentIntentRecord: async (data) => { saved = data; return { id: "test" }; },
      updatePaymentIntentRecord: async () => {},
    },
  });
  const result = await api.createPaymentIntentForSession({ id: "user", email: "", organizationId: "org" }, {
    amount: 200, provider: "manual", manualPayMethod: "binance", chargeCurrency: "PEN", idempotencyKey: "test",
  });
  assert.equal(saved.provider, "manual");
  assert.equal(saved.currency, "USD");
  assert.equal(saved.amountCents, 20000 + 200 * agreedFee);
  assert.equal(saved.metadata.fee_percent, agreedFee);
  assert.equal(saved.metadata.fee_holistic_percent, agreedFee);
  assert.equal(saved.metadata.credit_amount_cents, 20000);
  assert.equal(saved.metadata.manual_pay_method, "binance");
  assert.equal(saved.metadata.manual_manager_approval_required, true);
  assert.equal(result.checkoutUrl, null);
  assert.equal(result.grossChargeCents, 20000 + 200 * agreedFee);
});

}

test("the general fee defaults to 10 only when no client or account agreement exists", () => {
  const resolver = load("./resolve-hecom-deposit-fee.server.ts", {
    "@/lib/payments/deposit-fee": { depositFromDesiredCredit, normalizeFeePercent, DEFAULT_DEPOSIT_FEE_PERCENT },
  });
  const resolve = resolver.resolveFeePercentFromHecomCliente;
  assert.equal(resolve({ tiktokDefaultFee: null, accountFees: [] }).feePercent, 10);
  assert.equal(resolve({ tiktokDefaultFee: 7, accountFees: [10] }).feePercent, 7);
  assert.equal(resolve({ tiktokDefaultFee: null, accountFees: [3] }).feePercent, 3);
});
