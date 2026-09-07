import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { mergeMetadata } from "@/lib/records";
import {
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { readGrossPenCents } from "./reserve-amount.server";
import { completeBankConfirmedDeposit } from "./confirm-deposit.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { buildFingerprint, parseYapeNotificationText } from "./parse-notification";

export type YapeNotificationSource = "android_push" | "email" | "manual" | "test";

export interface IngestYapeNotificationInput {
  source: YapeNotificationSource;
  /** Texto crudo del push o del correo. Opcional si mandan campos estructurados. */
  rawText?: string | null;
  /** Céntimos de sol. Si falta, se intenta extraer de rawText. */
  amountCents?: number | null;
  operationNumber?: string | null;
  senderName?: string | null;
  /** ISO. Default: ahora. */
  receivedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export type YapeIngestOutcome =
  | { result: "duplicate"; notificationId: string | null }
  | { result: "unparsable"; reason: string }
  | { result: "matched"; notificationId: string; paymentIntentId: string }
  | { result: "unmatched"; notificationId: string; reason: string };

/**
 * Registra un cobro Yape observado y, si cruza con una recarga abierta, acredita.
 *
 * Todo pasa por acá: el push del celular, el correo del banco y la carga manual
 * del admin. Es el único camino que puede acreditar saldo con provider=yape.
 */
export async function ingestYapeNotification(
  input: IngestYapeNotificationInput,
): Promise<YapeIngestOutcome> {
  const parsed = input.rawText
    ? parseYapeNotificationText(input.rawText)
    : { amountCents: null, operationNumber: null, senderName: null };

  // Los campos explícitos del agente mandan sobre lo que saque el parser.
  const amountCents = normalizeAmountCents(input.amountCents) ?? parsed.amountCents;
  const operationNumber = trimOrNull(input.operationNumber) ?? parsed.operationNumber;
  const senderName = trimOrNull(input.senderName) ?? parsed.senderName;
  const receivedAt = normalizeTimestamp(input.receivedAt);

  if (amountCents === null || amountCents <= 0) {
    return {
      result: "unparsable",
      reason: "No se pudo determinar el monto del aviso.",
    };
  }

  const fingerprint = buildFingerprint({
    source: input.source,
    operationNumber,
    amountCents,
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
      operation_number: operationNumber,
      amount_cents: amountCents,
      currency: "PEN",
      sender_name: senderName,
      raw_text: input.rawText ?? null,
      received_at: receivedAt,
      status: "unmatched",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (insertError) {
    // 23505 = fingerprint u operation_number repetidos. El aviso ya se procesó;
    // reenviarlo no debe acreditar de nuevo.
    if (insertError.code === "23505") {
      const existingId = await findExistingNotificationId(fingerprint, operationNumber);
      return { result: "duplicate", notificationId: existingId };
    }
    throw new Error(insertError.message);
  }

  const notificationId = inserted?.id;
  if (!notificationId) {
    throw new Error("No se pudo registrar el aviso Yape.");
  }

  return matchNotification({
    notificationId,
    amountCents,
    operationNumber,
    senderName,
    receivedAt,
  });
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
  operationNumber: string | null;
  senderName: string | null;
  receivedAt: string;
}): Promise<YapeIngestOutcome> {
  const candidates = await findCandidateIntents(input.amountCents, input.receivedAt);

  if (candidates.length === 0) {
    const reason = "Sin recarga abierta por ese monto exacto.";
    await markUnmatched(input.notificationId, reason);
    return { result: "unmatched", notificationId: input.notificationId, reason };
  }

  if (candidates.length > 1) {
    // No debería pasar: el discriminador de céntimos existe justamente para
    // evitarlo. Si pasa, no adivinamos — que lo resuelva un humano.
    const reason = `Monto ambiguo: ${candidates.length} recargas abiertas coinciden.`;
    await markUnmatched(input.notificationId, reason);
    return { result: "unmatched", notificationId: input.notificationId, reason };
  }

  const intent = await getPaymentIntentByIdInternal(candidates[0]);
  if (!intent) {
    const reason = "La recarga candidata ya no existe.";
    await markUnmatched(input.notificationId, reason);
    return { result: "unmatched", notificationId: input.notificationId, reason };
  }

  // Dejamos escrito en la recarga que la plata llegó de verdad. Esta marca es
  // la condición que le falta al candado de auto-aprobación del comprobante.
  await updatePaymentIntentRecord(intent.id, {
    metadata: mergeMetadata(intent.metadata, {
      bank_confirmed_at: new Date().toISOString(),
      bank_confirmation_notification_id: input.notificationId,
      bank_confirmation_operation_number: input.operationNumber,
      bank_confirmation_sender_name: input.senderName,
      bank_confirmation_received_at: input.receivedAt,
      bank_confirmed_amount_pen_cents: input.amountCents,
    }),
  });

  // Si el cliente ya había subido un comprobante coherente, esto completa la
  // recarga. Si todavía no lo subió, no acredita: queda esperando, y el
  // comprobante cerrará el circuito cuando llegue. El comprobante es
  // obligatorio en los dos órdenes.
  await completeBankConfirmedDeposit({
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
      amount_cents_pen: input.amountCents,
    },
  });

  await createNotificationBestEffort({
    organizationId: intent.organizationId,
    userId: intent.createdBy ?? undefined,
    title: "Pago recibido",
    body: "Confirmamos tu Yape. Si ya mandaste el comprobante, el saldo entra en segundos.",
    type: "payment_bank_confirmed",
    data: { payment_intent_id: intent.id, url: "/payments" },
  });

  return {
    result: "matched",
    notificationId: input.notificationId,
    paymentIntentId: intent.id,
  };
}

/**
 * Un pago no puede pagar una recarga que todavía no existía.
 *
 * Sin esta regla hay un agujero real cuando corren dos canales (push y correo):
 * el push acredita al cliente A y libera su monto en soles; entra el cliente B
 * y le toca ese mismo monto, ahora libre; llega tarde el correo del pago de A y
 * cruzaría con la recarga de B, acreditándole saldo que nunca pagó.
 *
 * La tolerancia cubre el reloj corrido de un celular. Es chica a propósito: el
 * escenario de arriba necesita un ciclo entero de recarga, no dos minutos.
 */
const CLOCK_SKEW_TOLERANCE_MS = 2 * 60_000;

/**
 * Intents Yape abiertos cuyo monto esperado en PEN coincide exactamente.
 *
 * Se descartan los vencidos: pasada la ventana el monto vuelve al pool, así que
 * un pago tardío cae a revisión manual en vez de cruzar con la recarga de otro.
 */
async function findCandidateIntents(
  amountCents: number,
  receivedAt: string,
): Promise<string[]> {
  const admin = createAdminClient();

  // Cruzamos contra los pagos manuales cobrados en soles: son los que hoy
  // valida soporte a mano. No hay un proveedor aparte para Yape — es el mismo
  // "Pago manual" de siempre, pero validado solo.
  //
  // La comparación del monto se hace en JS y no con un filtro JSON en la
  // query: el conjunto está acotado por la ventana de cruce (las recargas
  // abiertas de las últimas horas, decenas como mucho) y así la decisión de
  // acreditar plata no depende de cómo PostgREST interprete `metadata->>campo`.
  const { data, error } = await admin
    .from("payment_intents")
    .select("id, amount_cents, metadata, created_at")
    .eq("provider", "manual")
    .eq("currency", "PEN")
    .in("status", ["created", "requires_payment", "processing"])
    .gte(
      "created_at",
      new Date(
        Date.now() - serverEnv.yapeMatchWindowMinutes * 60_000,
      ).toISOString(),
    )
    // El pago tiene que ser posterior a la recarga que dice pagar.
    .lte(
      "created_at",
      new Date(
        new Date(receivedAt).getTime() + CLOCK_SKEW_TOLERANCE_MS,
      ).toISOString(),
    )
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const now = Date.now();
  const paidAt = new Date(receivedAt).getTime();

  return (data ?? [])
    .filter((row) => {
      const typed = row as {
        amount_cents?: number;
        metadata?: unknown;
        created_at?: string;
      };
      const { created_at: createdAt } = typed;

      if (readGrossPenCents(typed) !== amountCents) return false;

      // Se repite en JS el filtro de fecha que ya hizo la query: es la regla
      // que impide acreditarle a otro cliente un pago que llegó tarde, y no
      // queremos que dependa de un solo lugar.
      if (createdAt) {
        const openedAt = new Date(createdAt).getTime();
        if (Number.isFinite(openedAt) && Number.isFinite(paidAt)) {
          if (openedAt > paidAt + CLOCK_SKEW_TOLERANCE_MS) return false;
        }
      }

      // La ventana de cruce ya la aplicó la query por created_at.
      void now;
      return true;
    })
    .map((row) => (row as { id: string }).id);
}

async function markUnmatched(notificationId: string, note: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("yape_inbound_notifications")
    .update({ status: "unmatched", match_note: note })
    .eq("id", notificationId);

  await admin.from("audit_logs").insert({
    organization_id: null,
    actor_user_id: null,
    action: "yape_notification.unmatched",
    entity_type: "yape_inbound_notification",
    entity_id: notificationId,
    metadata: { note },
  });
}

function normalizeAmountCents(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Un aviso no puede venir del futuro ni de hace más de un día: si el reloj del
 * celular está corrido, preferimos la hora del servidor.
 */
function normalizeTimestamp(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();

  const now = Date.now();
  if (parsed.getTime() > now) return new Date().toISOString();
  if (now - parsed.getTime() > 24 * 60 * 60 * 1000) return new Date().toISOString();

  return parsed.toISOString();
}
