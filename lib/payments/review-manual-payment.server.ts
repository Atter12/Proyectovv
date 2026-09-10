import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeJsonMetadata } from "@/lib/types/json";
import { isVoucherPaymentProvider } from "@/types/payment";
import { quoteFromGrossCharge } from "@/lib/payments/manual-deposit.shared";

export type ManualReviewActor = {
  id: string;
  email: string;
};

type IntentRow = {
  id: string;
  organization_id: string;
  wallet_id: string;
  amount_cents: number;
  currency: string;
  provider: string;
  provider_reference: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
};

async function insertAudit(input: {
  organizationId?: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  severity?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    organization_id: input.organizationId ?? null,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    severity: input.severity ?? "info",
    metadata: input.metadata ?? {},
  });
}

async function notify(input: {
  organizationId?: string | null;
  userId?: string | null;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    organization_id: input.organizationId ?? null,
    user_id: input.userId ?? null,
    title: input.title,
    body: input.body,
    type: input.type,
    data: input.data ?? {},
  });
}

function revalidateManualPaymentPaths(paymentIntentId: string) {
  revalidatePath("/payments");
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentIntentId}`);
  revalidatePath("/admin/overview");
}

async function loadVoucherIntent(paymentIntentId: string): Promise<IntentRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select(
      "id, organization_id, wallet_id, amount_cents, currency, provider, provider_reference, status, metadata, created_by",
    )
    .eq("id", paymentIntentId)
    .maybeSingle<IntentRow>();

  if (error) throw new Error(error.message);
  if (!data || !isVoucherPaymentProvider(data.provider)) {
    throw new Error("Pago con comprobante no encontrado.");
  }
  return data;
}

/**
 * Aprueba voucher y acredita saldo disponible en cartera (no asigna a TikTok).
 * Opcionalmente ajusta el monto cobrado real (ej. boleta 173.71 vs esperado 179.92).
 */
export async function approveManualVoucherPayment(input: {
  paymentIntentId: string;
  actor: ManualReviewActor;
  notes?: string | null;
  approvedFrom: "admin_panel" | "dashboard";
  /** Centavos en la moneda de cobro (PEN o USD) leídos de la boleta. */
  adjustedGrossChargeCents?: number | null;
}): Promise<{ journalId: string; creditUsdCents: number; grossChargeCents: number }> {
  const intent = await loadVoucherIntent(input.paymentIntentId);
  if (intent.status === "succeeded") {
    const meta = intent.metadata ?? {};
    const existing = meta.ledger_journal_id;
    const creditRaw = meta.credit_amount_cents;
    const creditUsdCents =
      typeof creditRaw === "number"
        ? creditRaw
        : typeof creditRaw === "string"
          ? Number(creditRaw)
          : intent.amount_cents;
    return {
      journalId: typeof existing === "string" ? existing : "",
      creditUsdCents: Number.isFinite(creditUsdCents) ? creditUsdCents : 0,
      grossChargeCents: intent.amount_cents,
    };
  }
  if (intent.status === "failed" || intent.status === "cancelled") {
    throw new Error("No se puede aprobar un pago fallido o cancelado.");
  }

  const admin = createAdminClient();
  const meta = (intent.metadata ?? {}) as Record<string, unknown>;
  const chargeCurrency =
    String(meta.charge_currency ?? intent.currency).toUpperCase() === "PEN"
      ? "PEN"
      : "USD";
  const feePercent = Number(meta.fee_percent);
  const fxRate = Number(meta.fx_rate_usd_pen);
  const safeFee = Number.isFinite(feePercent) && feePercent >= 0 ? feePercent : 10;
  const safeFx = Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 3.48;

  let amountCents = intent.amount_cents;
  let workingMeta = { ...meta };

  if (
    input.adjustedGrossChargeCents != null &&
    Number.isFinite(input.adjustedGrossChargeCents) &&
    input.adjustedGrossChargeCents > 0
  ) {
    const quote = quoteFromGrossCharge({
      grossChargeCents: Math.round(input.adjustedGrossChargeCents),
      chargeCurrency,
      feePercent: safeFee,
      fxRateUsdPen: safeFx,
    });
    if (quote.creditUsdCents < 1) {
      throw new Error("El monto ajustado es demasiado bajo para acreditar saldo.");
    }
    amountCents = quote.grossChargeCents;
    workingMeta = {
      ...workingMeta,
      charge_currency: chargeCurrency,
      fx_rate_usd_pen: quote.fxRateUsdPen,
      fee_percent: quote.feePercent,
      credit_amount_cents: quote.creditUsdCents,
      fee_amount_cents: quote.feeUsdCents,
      gross_usd_cents: quote.grossUsdCents,
      gross_amount_cents: quote.grossChargeCents,
      wallet_credit_currency: "USD",
      ...(chargeCurrency === "PEN"
        ? {
            gross_pen_cents: quote.grossPenCents,
            credit_pen_cents: quote.creditPenCents,
            fee_pen_cents: quote.feePenCents,
          }
        : {}),
      amount_adjusted_by: input.actor.id,
      amount_adjusted_by_email: input.actor.email,
      amount_adjusted_at: new Date().toISOString(),
      original_amount_cents: intent.amount_cents,
    };

    const { error: adjustError } = await admin
      .from("payment_intents")
      .update({
        amount_cents: amountCents,
        currency: chargeCurrency,
        updated_at: new Date().toISOString(),
        metadata: workingMeta,
      })
      .eq("id", intent.id)
      .neq("status", "succeeded");
    if (adjustError) throw new Error(adjustError.message);
  }

  const providerReference =
    intent.provider_reference ?? `${intent.provider}:${intent.id}`;

  const { data: journalId, error: ledgerError } = await admin.rpc(
    "ledger_confirm_deposit",
    {
      p_payment_intent_id: intent.id,
      p_provider_reference: providerReference,
      p_idempotency_key: `voucher-payment-approval:${intent.id}`,
      p_metadata: {
        approved_from: input.approvedFrom,
        approved_by: input.actor.id,
        approved_by_email: input.actor.email,
        provider: intent.provider,
        notes: input.notes ?? null,
      },
    },
  );
  if (ledgerError) throw new Error(ledgerError.message);

  const journalIdStr = String(journalId);
  const creditUsdCents = Number(workingMeta.credit_amount_cents) || 0;
  const succeededAt = new Date().toISOString();

  await admin
    .from("payment_intents")
    .update({
      status: "succeeded",
      provider_reference: providerReference,
      succeeded_at: succeededAt,
      updated_at: succeededAt,
      metadata: mergeJsonMetadata(workingMeta, {
        manual_review_status: "approved",
        approved_by: input.actor.id,
        approved_by_email: input.actor.email,
        approved_at: succeededAt,
        approval_notes: input.notes ?? null,
        approval_source: input.approvedFrom,
        ledger_journal_id: journalIdStr,
      }),
    })
    .eq("id", intent.id);

  const isCrypto = intent.provider === "crypto";
  await notify({
    organizationId: intent.organization_id,
    userId: intent.created_by,
    title: isCrypto ? "Pago cripto aprobado" : "Pago manual aprobado",
    body: "El saldo ya está disponible en la cartera. Puedes asignarlo a tu cuenta.",
    type: "payment_approved",
    data: {
      payment_intent_id: intent.id,
      ledger_journal_id: journalIdStr,
      url: "/payments",
    },
  });

  if (!isCrypto) {
    void import("@/lib/email/manual-payment-notify.server").then(
      ({ notifyClientManualPaymentApprovedBestEffort }) =>
        notifyClientManualPaymentApprovedBestEffort({
          paymentIntentId: intent.id,
          organizationId: intent.organization_id,
          createdBy: intent.created_by,
          chargeAmountCents: amountCents,
          chargeCurrency,
          creditUsdCents: creditUsdCents > 0 ? creditUsdCents : amountCents,
        }),
    );
  }

  await insertAudit({
    organizationId: intent.organization_id,
    actorUserId: input.actor.id,
    action:
      input.approvedFrom === "dashboard"
        ? "payments.manual_payment.approved"
        : "admin.manual_payment.approved",
    entityType: "payment_intent",
    entityId: intent.id,
    metadata: {
      amount_cents: amountCents,
      currency: chargeCurrency,
      provider: intent.provider,
      ledger_journal_id: journalIdStr,
      credit_amount_cents: creditUsdCents,
      notes: input.notes ?? null,
      approved_from: input.approvedFrom,
      adjusted:
        input.adjustedGrossChargeCents != null &&
        Math.round(input.adjustedGrossChargeCents) !== intent.amount_cents,
    },
  });

  // Lo pagado (Hecom) — mismo bridge que Stripe.
  try {
    const { syncWalletDepositCobroBestEffort } = await import(
      "@/lib/hecom/wallet-cobro-bridge.server"
    );
    const hecomClienteId =
      typeof workingMeta.hecom_cliente_id === "string"
        ? workingMeta.hecom_cliente_id
        : null;
    const grossUsd = Number(workingMeta.gross_usd_cents);
    const feeUsd = Number(workingMeta.fee_amount_cents);
    const cobroSync = await syncWalletDepositCobroBestEffort({
      hecomClienteId,
      paymentIntentId: intent.id,
      amountCents:
        Number.isFinite(grossUsd) && grossUsd > 0 ? grossUsd : creditUsdCents,
      creditCents: creditUsdCents > 0 ? creditUsdCents : null,
      feeCents: Number.isFinite(feeUsd) ? feeUsd : null,
      currency: "USD",
      paidAt: succeededAt,
      provider: intent.provider,
    });
    if (cobroSync) {
      await admin
        .from("payment_intents")
        .update({
          metadata: mergeJsonMetadata(workingMeta, {
            manual_review_status: "approved",
            approved_by: input.actor.id,
            approved_by_email: input.actor.email,
            approved_at: succeededAt,
            approval_notes: input.notes ?? null,
            approval_source: input.approvedFrom,
            ledger_journal_id: journalIdStr,
            hecom_cobro_sync: {
              ok: cobroSync.ok,
              skipped: cobroSync.skipped ?? false,
              reason: cobroSync.reason ?? null,
              cobro_id: cobroSync.cobroId ?? null,
              codigo: cobroSync.codigo ?? null,
              at: new Date().toISOString(),
            },
          }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", intent.id);
    }
  } catch (error) {
    console.error("[manual-approve] hecom cobro sync failed", error);
  }

  revalidateManualPaymentPaths(intent.id);
  return {
    journalId: journalIdStr,
    creditUsdCents,
    grossChargeCents: amountCents,
  };
}

export async function rejectManualVoucherPayment(input: {
  paymentIntentId: string;
  actor: ManualReviewActor;
  reason: string;
  rejectedFrom: "admin_panel" | "dashboard";
}): Promise<void> {
  const reason =
    input.reason.trim() ||
    "Comprobante rechazado por revisión administrativa.";
  const intent = await loadVoucherIntent(input.paymentIntentId);

  if (intent.status === "succeeded") {
    throw new Error("No se puede rechazar un pago ya aprobado.");
  }
  if (intent.status === "failed") return;

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("payment_intents")
    .update({
      status: "failed",
      failure_reason: reason,
      updated_at: new Date().toISOString(),
      metadata: mergeJsonMetadata(intent.metadata, {
        manual_review_status: "rejected",
        rejected_by: input.actor.id,
        rejected_by_email: input.actor.email,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        rejection_source: input.rejectedFrom,
      }),
    })
    .eq("id", intent.id);
  if (updateError) throw new Error(updateError.message);

  await notify({
    organizationId: intent.organization_id,
    userId: intent.created_by,
    title:
      intent.provider === "crypto"
        ? "Pago cripto rechazado"
        : "Pago manual rechazado",
    body: reason,
    type: "payment_rejected",
    data: { payment_intent_id: intent.id, url: "/payments" },
  });

  await insertAudit({
    organizationId: intent.organization_id,
    actorUserId: input.actor.id,
    action:
      input.rejectedFrom === "dashboard"
        ? "payments.manual_payment.rejected"
        : "admin.manual_payment.rejected",
    entityType: "payment_intent",
    entityId: intent.id,
    severity: "warning",
    metadata: {
      reason,
      amount_cents: intent.amount_cents,
      currency: intent.currency,
      rejected_from: input.rejectedFrom,
    },
  });

  revalidateManualPaymentPaths(intent.id);
}

const PAYMENT_PROOFS_BUCKET = "payment-proofs";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function getManualProofStoragePath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const proof = (metadata as Record<string, unknown>).manual_proof;
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return null;
  const record = proof as Record<string, unknown>;
  if (typeof record.path === "string" && record.path.trim()) {
    return record.path.trim();
  }
  if (typeof record.storage_path === "string" && record.storage_path.trim()) {
    return record.storage_path.trim();
  }
  return null;
}

export async function signPaymentProofUrl(
  storagePath: string | null | undefined,
): Promise<string | null> {
  const path = String(storagePath ?? "").replace(/^\//, "").trim();
  if (!path) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn("[manual-review] signed_url_failed", {
      path,
      message: error?.message,
    });
    return null;
  }
  return data.signedUrl;
}
