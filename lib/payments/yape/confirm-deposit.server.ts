import "server-only";
import { confirmDepositInLedger } from "@/lib/ledger/ledger.server";
import {
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeMetadata, isRecord, getString } from "@/lib/records";

/**
 * Cierre de una recarga cuando el cobro real ya fue confirmado.
 *
 * Para acreditar hacen falta DOS pruebas independientes:
 *
 *   1. El comprobante que sube el cliente, analizado y coherente.
 *   2. El aviso de cobro observado en la cuenta receptora.
 *
 * Ninguna alcanza sola. La captura se falsifica en minutos — ya pasó una vez
 * (`fake_voucher_auto_approve_incident`) — y el aviso del banco por sí solo no
 * prueba quién pagó si el comprobante todavía no llegó.
 *
 * Los dos órdenes funcionan: si el comprobante llega primero, lo cierra el
 * aviso; si el aviso llega primero, lo cierra el comprobante. Esta función es
 * el punto de encuentro y se puede llamar desde cualquiera de los dos lados.
 */

export type BankConfirmedOutcome =
  | { completed: true; journalId: string }
  | { completed: false; reason: string };

/** Un pago manual solo se acredita si el análisis del comprobante dio positivo. */
function hasConfirmedVoucher(metadata: unknown): boolean {
  if (!isRecord(metadata)) return false;
  const analysis = metadata.voucher_analysis;
  return isRecord(analysis) && analysis.confirmed === true;
}

export function readBankConfirmedAt(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null;
  return getString(metadata.bank_confirmed_at);
}

/** El neto en dólares que va a la cartera. El bruto en soles incluye el fee. */
function readCreditUsdCents(metadata: unknown, fallback: number): number {
  if (!isRecord(metadata)) return fallback;
  const raw = metadata.credit_amount_cents;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function completeBankConfirmedDeposit(input: {
  intentId: string;
  notificationId: string;
  operationNumber: string | null;
}): Promise<BankConfirmedOutcome> {
  const intent = await getPaymentIntentByIdInternal(input.intentId);
  if (!intent) return { completed: false, reason: "La recarga ya no existe." };

  if (intent.status === "succeeded") {
    return { completed: false, reason: "La recarga ya estaba acreditada." };
  }

  if (!hasConfirmedVoucher(intent.metadata)) {
    // El cliente todavía no subió comprobante, o el análisis no dio positivo.
    // Guardamos la confirmación del banco y esperamos: el comprobante es
    // obligatorio, así que sin él no se acredita.
    return {
      completed: false,
      reason: "Cobro confirmado, falta el comprobante del cliente.",
    };
  }

  // provider_reference es la llave anti-doble-abono: el índice único
  // (provider, provider_reference) rechaza acreditar el mismo cobro dos veces
  // aunque el matcher corra repetido.
  const providerReference = input.operationNumber
    ? `manual:yape:op:${input.operationNumber}`
    : `manual:yape:notif:${input.notificationId}`;

  const confirmedAt = new Date().toISOString();
  const creditUsdCents = readCreditUsdCents(intent.metadata, intent.amountCents);

  const journalId = await confirmDepositInLedger({
    paymentIntentId: intent.id,
    providerReference,
    idempotencyKey: `manual:yape:${input.notificationId}`,
    metadata: {
      provider: "manual",
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
      // Distinto de "voucher_ai": acá el cobro se verificó contra la cuenta
      // receptora, no solo contra la imagen que mandó el cliente.
      approval_source: "bank_notification",
      ledger_journal_id: journalId,
    }),
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
    },
  });

  await createNotificationBestEffort({
    organizationId: intent.organizationId,
    userId: intent.createdBy ?? undefined,
    title: "Recarga confirmada",
    body: "Verificamos tu pago y ya tenés saldo disponible en cartera.",
    type: "payment_approved",
    data: { payment_intent_id: intent.id, url: "/payments" },
  });

  return { completed: true, journalId };
}
