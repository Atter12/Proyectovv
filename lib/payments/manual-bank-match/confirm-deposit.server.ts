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

/**
 * Cierre de pago manual (BCP / Binance) con doble prueba:
 * 1) aviso de abono en el correo ops
 * 2) comprobante coherente del cliente
 *
 * Misma regla que Yape del bot: ninguna prueba sola acredita.
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
    security.duplicateOperationCode !== true;

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

  if (intent.status !== "requires_payment" && intent.status !== "processing") {
    return { completed: false, reason: "La recarga ya no está abierta." };
  }

  if (!hasConfirmedVoucher(intent.metadata)) {
    return {
      completed: false,
      reason: "Cobro confirmado, falta el comprobante del cliente.",
    };
  }

  const providerReference = input.operationNumber
    ? `manual:bank:op:${input.operationNumber}`
    : `manual:bank:notif:${input.notificationId}`;

  const confirmedAt = new Date().toISOString();
  const creditUsdCents = readCreditUsdCents(intent.metadata, intent.amountCents);

  const journalId = await confirmDepositInLedger({
    paymentIntentId: intent.id,
    providerReference,
    idempotencyKey: `manual:bank:${input.notificationId}`,
    metadata: {
      provider: "manual",
      source: MANUAL_DASHBOARD_SOURCE,
      auto_approved: true,
      approval_source: "bank_notification",
      bank_confirmation_notification_id: input.notificationId,
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
      approval_source: "bank_notification",
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
    action: "payment_intent.auto_approved_by_bank_notification",
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
