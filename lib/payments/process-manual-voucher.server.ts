import "server-only";
import {
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { mergeMetadata } from "@/lib/records";
import {
  analyzePaymentVoucher,
  hashVoucherBuffer,
  type VoucherAnalysisResult,
} from "@/lib/payments/voucher-analysis.server";
import {
  checkDuplicateOperationCode,
  checkDuplicateVoucherHash,
  checkVoucherUploadRateLimits,
  normalizeOperationCode,
  type VoucherSecurityFlags,
} from "@/lib/payments/voucher-security.server";
import type { ManualChargeCurrency } from "@/lib/payments/manual-deposit.server";
import { getManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import { isGatewayInMaintenance } from "@/lib/payments/gateway-config";
import { completeManualVoucherConfirmedDeposit } from "@/lib/payments/manual-bank-match/confirm-deposit.server";
import { MANUAL_DASHBOARD_SOURCE } from "@/lib/payments/manual-bank-match/source";
import { isMissingCobroPurpose, isLoPagadoDebtPurpose } from "@/lib/payments/missing-cobro.shared";

export type ProcessManualVoucherResult = {
  analysis: VoucherAnalysisResult;
  autoApproved: boolean;
  status: string;
  creditUsdCents: number;
  security: VoucherSecurityFlags;
  rateLimited?: boolean;
  rateLimitReason?: string | null;
};

function readChargeCurrency(
  metadata: Record<string, unknown> | null,
): ManualChargeCurrency {
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

function readCreditUsdCents(
  metadata: Record<string, unknown> | null,
  fallback: number,
): number {
  const raw = metadata?.credit_amount_cents;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export class VoucherRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoucherRateLimitError";
  }
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
      "El pago manual está deshabilitado temporalmente. Contacta con soporte.",
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
        duplicateCheckFailed: false,
      },
    };
  }

  if (intent.status !== "requires_payment" && intent.status !== "processing") {
    throw new Error("La recarga ya no está abierta.");
  }
  const metadata = (intent.metadata ?? {}) as Record<string, unknown>;
  const expected = readExpectedChargeAmount(intent.amountCents, metadata);
  const creditUsdCents = readCreditUsdCents(metadata, intent.amountCents);
  const contentHash = hashVoucherBuffer(input.buffer);

  const rateLimits = await checkVoucherUploadRateLimits(input.organizationId);
  if (!rateLimits.uploadAllowed) {
    throw new VoucherRateLimitError(
      rateLimits.reason ??
        "Se enviaron demasiados comprobantes. Inténtalo más tarde.",
    );
  }

  const destinationAccounts = getManualBankAccounts(expected.currency);
  const holders = destinationAccounts.map((a) => a.holder);

  const analysis = await analyzePaymentVoucher({
    buffer: input.buffer,
    mimeType: input.mimeType,
    expectedAmount: expected.amount,
    expectedCurrency: expected.currency,
    holderNames: holders,
    strictCurrency: true,
    destinationAccounts,
  });

  const hashCheck = await checkDuplicateVoucherHash(contentHash, intent.id);
  const duplicateHash = hashCheck.duplicate;
  const normalizedOperationCode = normalizeOperationCode(analysis.operationCode);
  const claimedOperationCode = normalizeOperationCode(
    typeof metadata.claimed_operation_code === "string"
      ? metadata.claimed_operation_code
      : null,
  );
  const opCodeForDedupe = normalizedOperationCode ?? claimedOperationCode;
  const opCodeCheck =
    opCodeForDedupe != null
      ? await checkDuplicateOperationCode(opCodeForDedupe, intent.id)
      : { duplicate: false, checkFailed: false };
  const duplicateOperationCode = opCodeCheck.duplicate;
  // Falla cerrada: si no pudimos consultar duplicados, no damos el comprobante
  // por limpio; lo mandamos a revisión como si fuera sospechoso.
  const duplicateCheckFailed = hashCheck.checkFailed || opCodeCheck.checkFailed;

  const security: VoucherSecurityFlags = {
    duplicateContentHash: duplicateHash,
    duplicateOperationCode,
    rateLimitBlocksAutoApprove: !rateLimits.autoApproveAllowed,
    uploadRateLimited: !rateLimits.uploadAllowed,
    duplicateCheckFailed,
  };

  if (duplicateHash) {
    analysis.confirmed = false;
    analysis.needsReview = true;
    analysis.reason = "Este comprobante ya se subió en otro pago.";
  } else if (duplicateOperationCode) {
    analysis.confirmed = false;
    analysis.needsReview = true;
    analysis.reason =
      "Este código de operación ya fue registrado en otro pago.";
  } else if (duplicateCheckFailed) {
    analysis.confirmed = false;
    analysis.needsReview = true;
    analysis.reason =
      "No pudimos verificar si este comprobante ya se usó. Un gerente lo revisará.";
  } else if (!rateLimits.autoApproveAllowed) {
    analysis.needsReview = true;
    analysis.confirmed = false;
    analysis.reason = rateLimits.reason ?? "No pudimos verificar los límites. Un gerente revisará el comprobante.";
  }

  const submittedAt = new Date().toISOString();
  // El panel valida destino, monto, moneda y duplicados sin esperar correo.
  const resolvedOpCode = normalizedOperationCode ?? claimedOperationCode;
  const baseMeta = mergeMetadata(metadata, {
    manual_review_status: "pending_review",
    voucher_approval_policy: "destination_v1",
    voucher_content_hash: contentHash,
    ...(resolvedOpCode ? { voucher_operation_code: resolvedOpCode } : {}),
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
    requires_manager_approval: true,
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "processing",
    metadata: baseMeta,
  });

  const isMissingCobro = isMissingCobroPurpose(metadata);
  const isDebtPayment = isLoPagadoDebtPurpose(metadata);
  const skipWalletAuto = isMissingCobro || isDebtPayment;

  if (!skipWalletAuto && analysis.confirmed && metadata.source === MANUAL_DASHBOARD_SOURCE) {
    await completeManualVoucherConfirmedDeposit({ intentId: intent.id });
  }

  const fresh = await getPaymentIntentByIdInternal(intent.id);
  const status = fresh?.status ?? "processing";
  const autoApproved = !skipWalletAuto && status === "succeeded";
  if (autoApproved) {
    return {
      analysis: {
        ...analysis,
        confirmed: true,
        needsReview: false,
      },
      autoApproved: true,
      status: "succeeded",
      creditUsdCents,
      security,
      rateLimited: !rateLimits.uploadAllowed,
      rateLimitReason: rateLimits.reason,
    };
  }


  await createNotificationBestEffort({
    organizationId: intent.organizationId,
    userId: intent.createdBy,
    title: analysis.confirmed
      ? "Comprobante recibido"
      : "Comprobante en revisión",
    body: isMissingCobro || isDebtPayment
      ? analysis.confirmed
        ? isDebtPayment
          ? "Recibimos tu comprobante. Gerencia lo revisará para bajar tu deuda del mes (no recarga cartera)."
          : "Recibimos tu comprobante. Gerencia lo revisará para registrarlo en Lo pagado (no recarga cartera)."
        : analysis.reason ||
          (isDebtPayment
            ? "Tu comprobante fue recibido. Un gerente lo revisará antes de bajar la deuda del mes."
            : "Tu comprobante fue recibido. Un gerente lo revisará antes de registrarlo en Lo pagado.")
      : analysis.confirmed
        ? "Comprobante recibido. La acreditación requiere revisión."
        : analysis.reason || "Un gerente revisará tu comprobante.",
    type: "payment_proof_uploaded",
    data: {
      payment_intent_id: intent.id,
      url: isMissingCobro ? "/cobros" : "/payments",
    },
  });

  // Todo comprobante no acreditado se comunica a gerencia.
  {
    const chargeCurrency = expected.currency;
    const chargeAmountCents =
      chargeCurrency === "PEN"
        ? Math.round(expected.amount * 100)
        : intent.amountCents;

    const { notifyManagersManualPaymentPendingBestEffort } = await import(
      "@/lib/email/manual-payment-notify.server"
    );
    await notifyManagersManualPaymentPendingBestEffort({
      paymentIntentId: intent.id,
      organizationId: intent.organizationId,
      createdBy: intent.createdBy,
      chargeAmountCents,
      chargeCurrency,
      creditUsdCents: isMissingCobro || isDebtPayment ? 0 : creditUsdCents,
      operationCode: normalizedOperationCode ?? claimedOperationCode,
      purpose:
        typeof metadata.purpose === "string" ? String(metadata.purpose) : null,
    });
  }

  return {
    analysis: {
      ...analysis,
      needsReview: true,
      reason: analysis.confirmed ? "Comprobante recibido. La acreditación requiere revisión." : analysis.reason,
    },
    autoApproved: false,
    status: "processing",
    creditUsdCents: isMissingCobro || isDebtPayment ? 0 : creditUsdCents,
    security,
    rateLimited: !rateLimits.uploadAllowed,
    rateLimitReason: rateLimits.reason,
  };
}
