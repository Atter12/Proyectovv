import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { updatePaymentIntentRecord } from "@/lib/payments/payment-intents.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNumber, isRecord, mergeMetadata } from "@/lib/records";

/**
 * Tope de acreditación automática (MANUAL_VOUCHER_AUTO_APPROVE_MAX_USD).
 *
 * El cierre dual (comprobante + aviso del banco) acredita sin que ningún
 * gerente mire. Para montos chicos está bien; para montos grandes, un error de
 * cruce o un comprobante bien falsificado sale caro. Por encima del tope, la
 * recarga queda esperando al gerente aunque las dos pruebas cuadren.
 */

const DEFAULT_MAX_USD = 500;

/** Tope en centavos USD netos a cartera. */
export function autoApproveMaxUsdCents(): number {
  const raw = serverEnv.manualVoucherAutoApproveMaxUsd;
  // Un valor mal escrito en la env no puede abrir la puerta: volvemos al
  // default en vez de tratarlo como "sin tope".
  if (!Number.isFinite(raw) || raw < 0) {
    console.warn(
      "[auto-approve-limit] MANUAL_VOUCHER_AUTO_APPROVE_MAX_USD inválido; uso el default",
      raw,
    );
    return DEFAULT_MAX_USD * 100;
  }
  return Math.round(raw * 100);
}

export function exceedsAutoApproveLimit(creditUsdCents: number): boolean {
  return creditUsdCents > autoApproveMaxUsdCents();
}

/**
 * Deja la recarga en la cola del gerente porque supera el tope.
 *
 * El matcher y el reintento del chat pueden llamar varias veces al cierre; la
 * marca `auto_approve_blocked` evita mandar el mismo aviso a gerentes en cada
 * vuelta.
 */
export async function holdForManagerReviewOverLimit(input: {
  intent: {
    id: string;
    organizationId: string;
    createdBy: string | null;
    amountCents: number;
    metadata: unknown;
  };
  creditUsdCents: number;
  chargeCurrency: "PEN" | "USD";
  channel: string;
}): Promise<void> {
  const metadata = isRecord(input.intent.metadata) ? input.intent.metadata : {};
  const alreadyHeld =
    isRecord(metadata.auto_approve_blocked) &&
    metadata.auto_approve_blocked.reason === "over_max_usd";
  if (alreadyHeld) return;

  const limitCents = autoApproveMaxUsdCents();
  const at = new Date().toISOString();

  await updatePaymentIntentRecord(input.intent.id, {
    metadata: mergeMetadata(metadata, {
      manual_review_status: "pending_review",
      requires_manager_approval: true,
      auto_approve_blocked: {
        reason: "over_max_usd",
        credit_usd_cents: input.creditUsdCents,
        limit_usd_cents: limitCents,
        at,
      },
    }),
  });

  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      organization_id: input.intent.organizationId,
      actor_user_id: null,
      action: "payment_intent.auto_approve_blocked_over_limit",
      entity_type: "payment_intent",
      entity_id: input.intent.id,
      metadata: {
        credit_usd_cents: input.creditUsdCents,
        limit_usd_cents: limitCents,
        channel: input.channel,
      },
    });
  } catch (error) {
    console.warn("[auto-approve-limit] audit log falló", error);
  }

  const chargeAmountCents =
    input.chargeCurrency === "PEN"
      ? (getNumber(metadata.gross_pen_cents) ?? input.intent.amountCents)
      : input.intent.amountCents;

  try {
    const { notifyManagersManualPaymentPendingBestEffort } = await import(
      "@/lib/email/manual-payment-notify.server"
    );
    await notifyManagersManualPaymentPendingBestEffort({
      paymentIntentId: input.intent.id,
      organizationId: input.intent.organizationId,
      createdBy: input.intent.createdBy,
      chargeAmountCents,
      chargeCurrency: input.chargeCurrency,
      creditUsdCents: input.creditUsdCents,
      operationCode:
        typeof metadata.voucher_operation_code === "string"
          ? metadata.voucher_operation_code
          : null,
      purpose: typeof metadata.purpose === "string" ? metadata.purpose : null,
    });
  } catch (error) {
    console.warn("[auto-approve-limit] aviso a gerentes falló", error);
  }
}
