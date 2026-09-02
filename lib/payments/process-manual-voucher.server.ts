import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmDepositInLedger } from "@/lib/ledger/ledger.server";
import { getPaymentIntentByIdInternal, updatePaymentIntentRecord } from "@/lib/payments/payment-intents.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { mergeMetadata } from "@/lib/records";
import {
  analyzePaymentVoucher,
  hashVoucherBuffer,
  type VoucherAnalysisResult,
} from "@/lib/payments/voucher-analysis.server";
import {
  checkVoucherUploadRateLimits,
  isDuplicateOperationCode,
  normalizeOperationCode,
  type VoucherSecurityFlags,
} from "@/lib/payments/voucher-security.server";
import type { ManualChargeCurrency } from "@/lib/payments/manual-deposit.server";
import { serverEnv } from "@/lib/env/env.server";
import { getManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import { isGatewayInMaintenance } from "@/lib/payments/gateway-config";

export type ProcessManualVoucherResult = {
  analysis: VoucherAnalysisResult;
  autoApproved: boolean;
  status: string;
  creditUsdCents: number;
  security: VoucherSecurityFlags;
  rateLimited?: boolean;
  rateLimitReason?: string | null;
};

function readChargeCurrency(metadata: Record<string, unknown> | null): ManualChargeCurrency {
  const raw = metadata?.charge_currency;
  return raw === "PEN" ? "PEN" : "USD";
}

function readExpectedChargeAmount(
  amountCents: number,
  metadata: Record<string, unknown> | null,
): { amount: number; currency: ManualChargeCurrency } {
  const currency = readChargeCurrency(metadata);
  if (currency === "PEN") {
    const penCents = Number(metadata?.gross_pen_cents ?? amountCents);
    return { amount: penCents / 100, currency: "PEN" };
  }
  return { amount: amountCents / 100, currency: "USD" };
}

function readCreditUsdCents(metadata: Record<string, unknown> | null, fallback: number): number {
  const raw = metadata?.credit_amount_cents;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function isDuplicateVoucherHash(hash: string, excludeIntentId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("id, metadata")
    .eq("provider", "manual")
    .eq("status", "succeeded")
    .contains("metadata", { voucher_content_hash: hash })
    .limit(5);

  if (error) {
    console.error("[manual-voucher] duplicate check failed", error.message);
    return false;
  }

  return (data ?? []).some((row) => row.id !== excludeIntentId);
}

export class VoucherRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoucherRateLimitError";
  }
}

function canAutoApproveCredit(creditUsdCents: number): boolean {
  const maxUsd = serverEnv.manualVoucherAutoApproveMaxUsd;
  return creditUsdCents / 100 <= maxUsd;
}

export async function processManualVoucherUpload(input: {
  paymentIntentId: string;
  organizationId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  storagePath: string;
  submittedBy: string;
}): Promise<ProcessManualVoucherResult> {
  const intent = await getPaymentIntentByIdInternal(input.paymentIntentId);
  if (!intent) throw new Error("Intención de pago no encontrada.");
  if (intent.organizationId !== input.organizationId) {
    throw new Error("La intención no pertenece a esta organización.");
  }
  if (intent.provider !== "manual") {
    throw new Error("Solo aplica a pago manual.");
  }
  if (isGatewayInMaintenance("manual")) {
    throw new Error(
      "Pago manual deshabilitado temporalmente. Contactá soporte o usá Stripe.",
    );
  }
  if (intent.status === "succeeded") {
    const meta = (intent.metadata ?? {}) as Record<string, unknown>;
    const analysis = meta.voucher_analysis as VoucherAnalysisResult | undefined;
    return {
      analysis:
        analysis ?? {
          confirmed: true,
          needsReview: false,
          confidence: 1,
          detectedAmount: null,
          detectedCurrency: null,
          operationCode: null,
          paymentDate: null,
          beneficiaryMatch: null,
          reason: "Pago ya acreditado.",
          analysisMode: "trust_upload",
        },
      autoApproved: true,
      status: "succeeded",
      creditUsdCents: readCreditUsdCents(meta, intent.amountCents),
      security: {
        duplicateContentHash: false,
        duplicateOperationCode: false,
        rateLimitBlocksAutoApprove: false,
        uploadRateLimited: false,
      },
    };
  }

  const metadata = (intent.metadata ?? {}) as Record<string, unknown>;
  const expected = readExpectedChargeAmount(intent.amountCents, metadata);
  const creditUsdCents = readCreditUsdCents(metadata, intent.amountCents);
  const contentHash = hashVoucherBuffer(input.buffer);

  const rateLimits = await checkVoucherUploadRateLimits(input.organizationId);
  if (!rateLimits.uploadAllowed) {
    throw new VoucherRateLimitError(
      rateLimits.reason ?? "Demasiados comprobantes. Intentá más tarde.",
    );
  }

  const holders = getManualBankAccounts(expected.currency).map((a) => a.holder);

  const analysis = await analyzePaymentVoucher({
    buffer: input.buffer,
    mimeType: input.mimeType,
    expectedAmount: expected.amount,
    expectedCurrency: expected.currency,
    holderNames: holders,
  });

  const duplicateHash = await isDuplicateVoucherHash(contentHash, intent.id);
  const normalizedOperationCode = normalizeOperationCode(analysis.operationCode);
  const duplicateOperationCode =
    normalizedOperationCode != null
      ? await isDuplicateOperationCode(normalizedOperationCode, intent.id)
      : false;

  const security: VoucherSecurityFlags = {
    duplicateContentHash: duplicateHash,
    duplicateOperationCode,
    rateLimitBlocksAutoApprove: !rateLimits.autoApproveAllowed,
    uploadRateLimited: !rateLimits.uploadAllowed,
  };

  if (duplicateHash) {
    analysis.confirmed = false;
    analysis.needsReview = true;
    analysis.reason = "Este comprobante ya fue usado en otro pago.";
  } else if (duplicateOperationCode) {
    analysis.confirmed = false;
    analysis.needsReview = true;
    analysis.reason =
      "Este código de operación ya fue registrado en otro pago.";
  } else if (!rateLimits.autoApproveAllowed && rateLimits.reason) {
    analysis.confirmed = false;
    analysis.needsReview = true;
    analysis.reason = rateLimits.reason;
  }

  const submittedAt = new Date().toISOString();
  let autoApproved = false;
  let nextStatus = "processing";

  const baseMeta = mergeMetadata(metadata, {
    manual_review_status: analysis.confirmed ? "approved" : "pending_review",
    voucher_content_hash: contentHash,
    ...(normalizedOperationCode ?
      { voucher_operation_code: normalizedOperationCode }
    : {}),
    voucher_security: security,
    manual_proof: {
      bucket: "payment-proofs",
      path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.buffer.length,
      submitted_at: submittedAt,
      submitted_by: input.submittedBy,
    },
    voucher_analysis: analysis,
    voucher_analyzed_at: submittedAt,
  });

  if (
    analysis.confirmed &&
    !duplicateHash &&
    !duplicateOperationCode &&
    rateLimits.autoApproveAllowed &&
    canAutoApproveCredit(creditUsdCents)
  ) {
    const providerReference = `manual:voucher:${intent.id}`;
    const journalId = await confirmDepositInLedger({
      paymentIntentId: intent.id,
      providerReference,
      idempotencyKey: `manual:voucher:auto:${intent.id}`,
      metadata: {
        provider: "manual",
        auto_approved: true,
        voucher_analysis_mode: analysis.analysisMode,
        voucher_content_hash: contentHash,
        ...(normalizedOperationCode ?
          { voucher_operation_code: normalizedOperationCode }
        : {}),
      },
    });

    await updatePaymentIntentRecord(intent.id, {
      status: "succeeded",
      providerReference,
      succeededAt: submittedAt,
      metadata: mergeMetadata(baseMeta, {
        manual_review_status: "approved",
        auto_approved: true,
        ledger_journal_id: journalId,
        approved_at: submittedAt,
        approval_source: "voucher_ai",
      }),
    });

    await createNotificationBestEffort({
      organizationId: intent.organizationId,
      userId: intent.createdBy,
      title: "Recarga confirmada",
      body: `Tu pago manual fue verificado. Ya tenés saldo disponible en cartera.`,
      type: "payment_approved",
      data: { payment_intent_id: intent.id, url: "/payments" },
    });

    autoApproved = true;
    nextStatus = "succeeded";
  } else {
    await updatePaymentIntentRecord(intent.id, {
      status: "processing",
      metadata: baseMeta,
    });

    await createNotificationBestEffort({
      organizationId: intent.organizationId,
      userId: intent.createdBy,
      title: "Comprobante en revisión",
      body: analysis.reason,
      type: "payment_proof_uploaded",
      data: { payment_intent_id: intent.id, url: "/payments" },
    });
  }

  return {
    analysis,
    autoApproved,
    status: nextStatus,
    creditUsdCents,
    security,
    rateLimited: !rateLimits.uploadAllowed,
    rateLimitReason: rateLimits.reason,
  };
}
