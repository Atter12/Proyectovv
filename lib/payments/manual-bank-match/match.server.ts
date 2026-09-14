import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { mergeMetadata, getNumber, isRecord } from "@/lib/records";
import {
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { normalizeOperationCode } from "@/lib/payments/voucher-security.server";
import { readGrossPenCents } from "@/lib/payments/yape/reserve-amount.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { completeManualBankConfirmedDeposit } from "./confirm-deposit.server";
import { MANUAL_BANK_CHANNEL, MANUAL_DASHBOARD_SOURCE } from "./source";
import { readGrossUsdCents } from "./reserve-amount.server";
import {
  buildManualBankFingerprint,
  parseManualBankNotificationText,
  type ManualBankCurrency,
  type ManualBankRail,
} from "./parse-notification";

export type ManualBankNotificationSource =
  | "android_push"
  | "email"
  | "manual"
  | "test";

export interface IngestManualBankNotificationInput {
  source: ManualBankNotificationSource;
  rawText?: string | null;
  amountCents?: number | null;
  currency?: ManualBankCurrency | null;
  operationNumber?: string | null;
  senderName?: string | null;
  receivedAt?: string | null;
  rail?: ManualBankRail | null;
  metadata?: Record<string, unknown>;
}

export type ManualBankIngestOutcome =
  | { result: "duplicate"; notificationId: string | null }
  | { result: "ignored"; reason: string }
  | { result: "unparsable"; reason: string }
  | { result: "matched"; notificationId: string; paymentIntentId: string }
  | { result: "unmatched"; notificationId: string; reason: string };

const CLOCK_SKEW_TOLERANCE_MS = 2 * 60_000;

/**
 * Registra un abono BCP/Binance y cruza solo con intents del panel (dashboard).
 * No toca recargas del bot Yape ni Cobrana.
 */
export async function ingestManualBankNotification(
  input: IngestManualBankNotificationInput,
): Promise<ManualBankIngestOutcome> {
  const parsed = input.rawText
    ? parseManualBankNotificationText(input.rawText)
    : {
        amountCents: null,
        currency: null,
        operationNumber: null,
        senderName: null,
        rail: "unknown" as const,
        direction: "unknown" as const,
      };

  const amountCents =
    normalizeAmountCents(input.amountCents) ?? parsed.amountCents;
  const currency = input.currency ?? parsed.currency;
  const operationNumber =
    trimOrNull(input.operationNumber) ?? parsed.operationNumber;
  const senderName = trimOrNull(input.senderName) ?? parsed.senderName;
  const rail = input.rail ?? parsed.rail;
  const receivedAt = normalizeTimestamp(input.receivedAt);

  if (amountCents === null || amountCents <= 0 || !currency) {
    return {
      result: "unparsable",
      reason: "No se pudo determinar monto/moneda del aviso de abono.",
    };
  }

  const direction =
    input.source === "manual" ? "inbound" : parsed.direction;

  if (direction !== "inbound") {
    const reason =
      direction === "outbound"
        ? "El aviso es de plata que salió de la cuenta, no de un abono recibido."
        : "El aviso no dice claramente que se haya recibido un abono.";

    await recordIgnoredNotification({
      source: input.source,
      amountCents,
      currency,
      operationNumber,
      senderName,
      receivedAt,
      rawText: input.rawText ?? null,
      rail,
      metadata: input.metadata,
      reason,
    });

    return { result: "ignored", reason };
  }

  const fingerprint = buildManualBankFingerprint({
    source: input.source,
    operationNumber,
    amountCents,
    currency,
    senderName,
    receivedAt,
    rawText: input.rawText ?? null,
  });

  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin
    .from("yape_inbound_notifications")
    .insert({
      source: input.source,
      fingerprint,
      operation_number: operationNumber
        ? `manual:${currency}:${operationNumber}`
        : null,
      amount_cents: amountCents,
      currency,
      sender_name: senderName,
      raw_text: input.rawText ?? null,
      received_at: receivedAt,
      status: "unmatched",
      metadata: {
        ...(input.metadata ?? {}),
        channel: MANUAL_BANK_CHANNEL,
        rail,
        charge_currency: currency,
      },
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (insertError) {
    if (insertError.code === "23505") {
      const existingId = await findExistingNotificationId(
        fingerprint,
        operationNumber ? `manual:${currency}:${operationNumber}` : null,
      );
      return { result: "duplicate", notificationId: existingId };
    }
    throw new Error(insertError.message);
  }

  const notificationId = inserted?.id;
  if (!notificationId) {
    throw new Error("No se pudo registrar el aviso de abono manual.");
  }

  return matchNotification({
    notificationId,
    amountCents,
    currency,
    operationNumber,
    senderName,
    receivedAt,
    rail,
  });
}

async function recordIgnoredNotification(input: {
  source: ManualBankNotificationSource;
  amountCents: number;
  currency: ManualBankCurrency;
  operationNumber: string | null;
  senderName: string | null;
  receivedAt: string;
  rawText: string | null;
  rail: ManualBankRail;
  metadata?: Record<string, unknown>;
  reason: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("yape_inbound_notifications").insert({
      source: input.source,
      fingerprint: buildManualBankFingerprint({
        source: input.source,
        operationNumber: input.operationNumber,
        amountCents: input.amountCents,
        currency: input.currency,
        senderName: input.senderName,
        receivedAt: input.receivedAt,
        rawText: input.rawText,
      }),
      operation_number: input.operationNumber
        ? `manual:${input.currency}:${input.operationNumber}`
        : null,
      amount_cents: input.amountCents,
      currency: input.currency,
      sender_name: input.senderName,
      raw_text: input.rawText,
      received_at: input.receivedAt,
      status: "ignored",
      match_note: input.reason,
      metadata: {
        ...(input.metadata ?? {}),
        channel: MANUAL_BANK_CHANNEL,
        rail: input.rail,
      },
    });
  } catch (error) {
    console.warn("[manual-bank] no se pudo registrar el aviso descartado", error);
  }
}

async function findExistingNotificationId(
  fingerprint: string,
  operationNumber: string | null,
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: byFingerprint } = await admin
    .from("yape_inbound_notifications")
    .select("id")
    .eq("fingerprint", fingerprint)
    .maybeSingle<{ id: string }>();
  if (byFingerprint?.id) return byFingerprint.id;

  if (!operationNumber) return null;

  const { data: byOperation } = await admin
    .from("yape_inbound_notifications")
    .select("id")
    .eq("operation_number", operationNumber)
    .maybeSingle<{ id: string }>();
  return byOperation?.id ?? null;
}

async function matchNotification(input: {
  notificationId: string;
  amountCents: number;
  currency: ManualBankCurrency;
  operationNumber: string | null;
  senderName: string | null;
  receivedAt: string;
  rail: ManualBankRail;
}): Promise<ManualBankIngestOutcome> {
  const operationCode = normalizeOperationCode(input.operationNumber);

  if (operationCode) {
    const byOperation = await findDashboardIntentsByOperationCode(
      operationCode,
      input.currency,
    );

    if (byOperation.length === 1) {
      const intent = await getPaymentIntentByIdInternal(byOperation[0].id);
      if (!intent) {
        const reason = "La recarga candidata ya no existe.";
        await markUnmatched(input.notificationId, reason);
        return {
          result: "unmatched",
          notificationId: input.notificationId,
          reason,
        };
      }

      const expected = byOperation[0].grossCents;
      if (expected !== null && expected !== input.amountCents) {
        const reason = `El N° de operación coincide pero el monto no: aviso ${(input.amountCents / 100).toFixed(2)}, recarga ${(expected / 100).toFixed(2)}.`;
        await markUnmatched(input.notificationId, reason);
        return {
          result: "unmatched",
          notificationId: input.notificationId,
          reason,
        };
      }

      return confirmMatch(intent, input, operationCode);
    }

    if (byOperation.length > 1) {
      const reason = `N° de operación ambiguo: ${byOperation.length} recargas lo declaran.`;
      await markUnmatched(input.notificationId, reason);
      return {
        result: "unmatched",
        notificationId: input.notificationId,
        reason,
      };
    }
  }

  const candidates = await findCandidateDashboardIntents(
    input.amountCents,
    input.currency,
    input.receivedAt,
    input.rail,
  );

  if (candidates.length === 0) {
    const reason = "Sin pago manual abierto por ese monto exacto.";
    await markUnmatched(input.notificationId, reason);
    return {
      result: "unmatched",
      notificationId: input.notificationId,
      reason,
    };
  }

  if (candidates.length > 1) {
    const reason = `Monto ambiguo: ${candidates.length} pagos manuales abiertos coinciden.`;
    await markUnmatched(input.notificationId, reason);
    return {
      result: "unmatched",
      notificationId: input.notificationId,
      reason,
    };
  }

  const intent = await getPaymentIntentByIdInternal(candidates[0]);
  if (!intent) {
    const reason = "La recarga candidata ya no existe.";
    await markUnmatched(input.notificationId, reason);
    return {
      result: "unmatched",
      notificationId: input.notificationId,
      reason,
    };
  }

  return confirmMatch(intent, input, operationCode);
}

async function findDashboardIntentsByOperationCode(
  operationCode: string,
  currency: ManualBankCurrency,
): Promise<Array<{ id: string; grossCents: number | null }>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("id, amount_cents, metadata, currency")
    .eq("provider", "manual")
    .eq("currency", currency)
    .in("status", ["created", "requires_payment", "processing"])
    .contains("metadata", {
      voucher_operation_code: operationCode,
      source: MANUAL_DASHBOARD_SOURCE,
    });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const typed = row as {
      id: string;
      amount_cents?: number;
      metadata?: unknown;
      currency?: string;
    };
    return {
      id: typed.id,
      grossCents:
        currency === "PEN"
          ? readGrossPenCents(typed)
          : readGrossUsdCents(typed),
    };
  });
}

async function findCandidateDashboardIntents(
  amountCents: number,
  currency: ManualBankCurrency,
  receivedAt: string,
  rail: ManualBankRail,
): Promise<string[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("payment_intents")
    .select("id, amount_cents, metadata, created_at, currency")
    .eq("provider", "manual")
    .eq("currency", currency)
    .contains("metadata", { source: MANUAL_DASHBOARD_SOURCE })
    .in("status", ["created", "requires_payment", "processing"])
    .gte(
      "created_at",
      new Date(
        Date.now() - serverEnv.yapeMatchWindowMinutes * 60_000,
      ).toISOString(),
    )
    .lte(
      "created_at",
      new Date(
        new Date(receivedAt).getTime() + CLOCK_SKEW_TOLERANCE_MS,
      ).toISOString(),
    )
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const paidAt = new Date(receivedAt).getTime();

  return (data ?? [])
    .filter((row) => {
      const typed = row as {
        amount_cents?: number;
        metadata?: unknown;
        created_at?: string;
      };

      const expected =
        currency === "PEN"
          ? readGrossPenCents(typed)
          : readGrossUsdCents(typed);
      if (expected !== amountCents) return false;

      // Si el cliente ya eligió bank/binance en el voucher, refuerza el rail.
      if (isRecord(typed.metadata)) {
        const payMethod =
          typed.metadata.pay_method ?? typed.metadata.manual_pay_method;
        if (payMethod === "binance" && rail === "bcp_transfer") return false;
        if (payMethod === "bank" && rail === "binance") return false;
      }

      if (typed.created_at) {
        const openedAt = new Date(typed.created_at).getTime();
        if (Number.isFinite(openedAt) && Number.isFinite(paidAt)) {
          if (openedAt > paidAt + CLOCK_SKEW_TOLERANCE_MS) return false;
        }
      }

      return true;
    })
    .map((row) => (row as { id: string }).id);
}

async function confirmMatch(
  intent: NonNullable<Awaited<ReturnType<typeof getPaymentIntentByIdInternal>>>,
  input: {
    notificationId: string;
    amountCents: number;
    currency: ManualBankCurrency;
    operationNumber: string | null;
    senderName: string | null;
    receivedAt: string;
    rail: ManualBankRail;
  },
  operationCode: string | null,
): Promise<ManualBankIngestOutcome> {
  await updatePaymentIntentRecord(intent.id, {
    metadata: mergeMetadata(intent.metadata, {
      bank_confirmed_at: new Date().toISOString(),
      bank_confirmation_notification_id: input.notificationId,
      bank_confirmation_operation_number:
        operationCode ?? input.operationNumber,
      bank_confirmation_sender_name: input.senderName,
      bank_confirmation_received_at: input.receivedAt,
      bank_confirmed_amount_cents: input.amountCents,
      bank_confirmed_currency: input.currency,
      bank_confirmation_rail: input.rail,
    }),
  });

  await completeManualBankConfirmedDeposit({
    intentId: intent.id,
    notificationId: input.notificationId,
    operationNumber: input.operationNumber,
  });

  const admin = createAdminClient();
  await admin
    .from("yape_inbound_notifications")
    .update({
      status: "matched",
      matched_payment_intent_id: intent.id,
      matched_at: new Date().toISOString(),
      match_note: null,
    })
    .eq("id", input.notificationId);

  await admin.from("audit_logs").insert({
    organization_id: intent.organizationId,
    actor_user_id: null,
    action: "payment_intent.bank_notification_matched",
    entity_type: "payment_intent",
    entity_id: intent.id,
    metadata: {
      notification_id: input.notificationId,
      operation_number: input.operationNumber,
      amount_cents: input.amountCents,
      currency: input.currency,
      rail: input.rail,
      channel: MANUAL_BANK_CHANNEL,
    },
  });

  await createNotificationBestEffort({
    organizationId: intent.organizationId,
    userId: intent.createdBy ?? undefined,
    title: "Pago recibido",
    body: "Confirmamos tu transferencia. Si ya mandaste el comprobante, el saldo entra en segundos.",
    type: "payment_bank_confirmed",
    data: { payment_intent_id: intent.id, url: "/payments" },
  });

  return {
    result: "matched",
    notificationId: input.notificationId,
    paymentIntentId: intent.id,
  };
}

async function markUnmatched(
  notificationId: string,
  reason: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("yape_inbound_notifications")
    .update({
      status: "unmatched",
      match_note: reason,
    })
    .eq("id", notificationId);
}

function normalizeAmountCents(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function trimOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimestamp(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

/** Helper exportado por si hace falta debug de montos. */
export function readExpectedChargeCents(row: {
  amount_cents?: number;
  metadata?: unknown;
  currency?: string;
}): number | null {
  if (isRecord(row.metadata) && row.metadata.charge_currency === "PEN") {
    return readGrossPenCents(row);
  }
  if (row.currency === "PEN") return readGrossPenCents(row);
  return readGrossUsdCents(row) ?? getNumber(row.amount_cents);
}
