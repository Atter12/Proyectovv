import "server-only";
import { confirmDepositInLedger } from "@/lib/ledger/ledger.server";
import {
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeMetadata, isRecord, getString } from "@/lib/records";
import { ensureHecomWalletCobroSyncedBestEffort } from "@/lib/hecom/ensure-wallet-cobro.server";
import { MANUAL_DASHBOARD_SOURCE } from "./source";
import { checkDuplicateOperationCode, checkDuplicateVoucherHash } from "@/lib/payments/voucher-security.server";
import { isMissingCobroPurpose, isLoPagadoDebtPurpose } from "@/lib/payments/missing-cobro.shared";
import {
  exceedsAutoApproveLimit,
  holdForManagerReviewOverLimit,
} from "@/lib/payments/auto-approve-limit.server";

/**
 * Recargas nuevas del panel: comprobante con destino verificado y sin duplicados.
 * La ruta bancaria conserva la doble prueba para comprobantes anteriores.
 * Un correo tardío nunca relaja la política nueva ni cambia su idempotencia.
 */

export type ManualBankConfirmedOutcome =
  | { completed: true; journalId: string }
  | { completed: false; reason: string };

function hasConfirmedVoucher(metadata: unknown): boolean {
  if (!isRecord(metadata)) return false;

  const analysis = metadata.voucher_analysis;
  if (!isRecord(analysis)) return false;
  if (analysis.confirmed === true) return true;

  const security = metadata.voucher_security;
  if (!isRecord(security)) return false;

  const soloLimitePorHora =
    security.rateLimitBlocksAutoApprove === true &&
    security.duplicateContentHash !== true &&
    security.duplicateOperationCode !== true &&
    // Si no se pudo consultar duplicados, no hay base para relajar nada.
    security.duplicateCheckFailed !== true;

  const analisisSano =
    analysis.beneficiaryMatch === true &&
    typeof analysis.detectedAmount === "number" &&
    analysis.detectedAmount > 0;

  return soloLimitePorHora && analisisSano;
}

export function readBankConfirmedAt(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  return getString(metadata.bank_confirmed_at);
}

function readCreditUsdCents(metadata: unknown, fallback: number): number {
  if (!isRecord(metadata)) return fallback;
  const raw = metadata.credit_amount_cents;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function completeManualBankConfirmedDeposit(input: {
  intentId: string;
  notificationId: string;
  operationNumber: string | null;
}): Promise<ManualBankConfirmedOutcome> {
  return completeDeposit(input);
}

export async function completeManualVoucherConfirmedDeposit(input: {
  intentId: string;
}): Promise<ManualBankConfirmedOutcome> {
  return completeDeposit({ ...input, voucherOnly: true, notificationId: null, operationNumber: null });
}

async function completeDeposit(input: {
  intentId: string;
  notificationId: string | null;
  operationNumber: string | null;
  voucherOnly?: boolean;
}): Promise<ManualBankConfirmedOutcome> {
  const intent = await getPaymentIntentByIdInternal(input.intentId);
  if (!intent) return { completed: false, reason: "La recarga ya no existe." };

  if (intent.status === "succeeded") {
    return { completed: false, reason: "La recarga ya estaba acreditada." };
  }

  if (
    !isRecord(intent.metadata) ||
    intent.metadata.source !== MANUAL_DASHBOARD_SOURCE
  ) {
    return {
      completed: false,
      reason: "No es un pago manual del panel (dashboard).",
    };
  }

  if (
    isMissingCobroPurpose(intent.metadata) ||
    isLoPagadoDebtPurpose(intent.metadata) ||
    intent.metadata.skip_wallet_credit === true
  ) {
    return {
      completed: false,
      reason: "Este pago no acredita cartera. Lo revisa gerencia.",
    };
  }

  if (intent.status !== "requires_payment" && intent.status !== "processing") {
    return { completed: false, reason: "La recarga ya no está abierta." };
  }

  const voucherOnly = input.voucherOnly === true || intent.metadata.voucher_approval_policy === "destination_v1";
  if (voucherOnly) {
    const analysis = intent.metadata.voucher_analysis;
    const security = intent.metadata.voucher_security;
    const hash = getString(intent.metadata.voucher_content_hash);
    const operation = getString(intent.metadata.voucher_operation_code);
    if (intent.provider !== "manual" || intent.metadata.voucher_approval_policy !== "destination_v1" ||
      !isRecord(analysis) || analysis.confirmed !== true || analysis.destinationVerified !== true || analysis.receiptScreeningPassed !== true ||
      analysis.accountMatch !== true || analysis.beneficiaryMatch !== true || analysis.analysisMode !== "openai_vision" ||
      !isRecord(security) || security.duplicateContentHash !== false || security.duplicateOperationCode !== false ||
      security.duplicateCheckFailed !== false || security.rateLimitBlocksAutoApprove !== false || !hash || !operation) {
      return { completed: false, reason: "El comprobante requiere revisión." };
    }
    // Recheck after persisting the proof so simultaneous submissions are visible.
    const [byHash, byOperation] = await Promise.all([
      checkDuplicateVoucherHash(hash, intent.id), checkDuplicateOperationCode(operation, intent.id),
    ]);
    if (byHash.duplicate || byHash.checkFailed || byOperation.duplicate || byOperation.checkFailed) {
      return { completed: false, reason: "Comprobante duplicado o verificación no disponible." };
    }
  }

  if (!hasConfirmedVoucher(intent.metadata)) {
    return {
      completed: false,
      reason: "Cobro confirmado, falta el comprobante del cliente.",
    };
  }

  const creditUsdCents = readCreditUsdCents(intent.metadata, intent.amountCents);

  // Por encima del tope, las dos pruebas no alcanzan: acredita un gerente.
  // La confirmación del banco ya quedó guardada en metadata, así que el
  // gerente ve la recarga con las dos pruebas a la vista.
  if (!voucherOnly && exceedsAutoApproveLimit(creditUsdCents)) {
    await holdForManagerReviewOverLimit({
      intent,
      creditUsdCents,
      chargeCurrency: intent.metadata.charge_currency === "PEN" ? "PEN" : "USD",
      channel: "manual_dashboard",
    });
    return {
      completed: false,
      reason: "El monto supera el tope de acreditación automática. Lo aprueba un gerente.",
    };
  }

  const approvalSource = voucherOnly ? "voucher_destination" : "bank_notification";
  const providerReference = voucherOnly
    ? `manual:voucher:op:${getString(intent.metadata.voucher_operation_code)}`
    : input.operationNumber
    ? `manual:bank:op:${input.operationNumber}`
    : `manual:bank:notif:${input.notificationId}`;

  const confirmedAt = new Date().toISOString();

  const journalId = await confirmDepositInLedger({
    paymentIntentId: intent.id,
    providerReference,
    idempotencyKey: voucherOnly ? `manual:voucher:${intent.id}` : `manual:bank:${input.notificationId}`,
    metadata: {
      provider: "manual",
      source: MANUAL_DASHBOARD_SOURCE,
      auto_approved: true,
      approval_source: approvalSource,
      ...(voucherOnly ? {} : { bank_confirmation_notification_id: input.notificationId }),
      credit_amount_cents: creditUsdCents,
    },
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "succeeded",
    providerReference,
    succeededAt: confirmedAt,
    metadata: mergeMetadata(intent.metadata, {
      manual_review_status: "approved",
      auto_approved: true,
      approved_at: confirmedAt,
      approval_source: approvalSource,
      ledger_journal_id: journalId,
      requires_manager_approval: false,
    }),
  });

  await ensureHecomWalletCobroSyncedBestEffort({
    intent: {
      id: intent.id,
      amountCents: intent.amountCents,
      currency: intent.currency,
      provider: intent.provider,
      metadata: intent.metadata as Record<string, unknown> | null,
      providerReference,
    },
    providerReference,
    ledgerJournalId: journalId,
    succeededAt: confirmedAt,
  });

  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    organization_id: intent.organizationId,
    actor_user_id: null,
    action: voucherOnly ? "payment_intent.auto_approved_by_voucher_destination" : "payment_intent.auto_approved_by_bank_notification",
    entity_type: "payment_intent",
    entity_id: intent.id,
    metadata: {
      notification_id: input.notificationId,
      operation_number: input.operationNumber,
      provider_reference: providerReference,
      credit_amount_cents: creditUsdCents,
      channel: "manual_dashboard",
    },
  });

  await createNotificationBestEffort({
    organizationId: intent.organizationId,
    userId: intent.createdBy ?? undefined,
    title: "Recarga confirmada",
    body: "Verificamos tu pago y ya tienes saldo disponible en tu cartera.",
    type: "payment_approved",
    data: { payment_intent_id: intent.id, url: "/payments" },
  });

  return { completed: true, journalId };
}
