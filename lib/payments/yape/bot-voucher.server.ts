import "server-only";
import type { SessionUser } from "@/types/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPaymentIntentByIdInternal,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { getNumber, getString, isRecord, mergeMetadata } from "@/lib/records";
import {
  analyzePaymentVoucher,
  hashVoucherBuffer,
} from "@/lib/payments/voucher-analysis.server";
import {
  checkVoucherUploadRateLimits,
  isDuplicateOperationCode,
  normalizeOperationCode,
  type VoucherSecurityFlags,
} from "@/lib/payments/voucher-security.server";
import { completeBankConfirmedDeposit } from "./confirm-deposit.server";
import { pollYapeMailboxThrottled } from "./poll-mailbox.server";
import { RECHARGE_BOT_SOURCE, YAPE_RECIPIENT } from "./recipient";
import { RechargeBotUserError } from "./recharge-chat.server";

/**
 * Comprobante que el cliente sube en el chat del bot.
 *
 * No pasa por processManualVoucherUpload: ese es el de la recarga manual y
 * siempre la manda al gerente. Aquí el comprobante es una de las dos pruebas
 * (la otra es el aviso del banco) y, si las dos cuadran, el saldo entra solo.
 *
 * Se guarda con las mismas claves que un comprobante manual (`manual_proof`,
 * `voucher_analysis`, `manual_review_status`). Así, si el bot no puede validar,
 * la recarga aparece tal cual en la cola del gerente, como se acordó.
 */

const PAYMENT_PROOFS_BUCKET = "payment-proofs";
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export type BotVoucherResult = {
  intent: { id: string; status: string };
  replies: string[];
};

function sanitizeFileName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return base.slice(-80) || "comprobante";
}

async function isDuplicateVoucherHash(hash: string, excludeIntentId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select("id")
    .eq("provider", "manual")
    .eq("status", "succeeded")
    .contains("metadata", { voucher_content_hash: hash })
    .limit(5);
  if (error) {
    console.error("[recharge-bot/voucher] no se pudo revisar duplicados", error.message);
    return false;
  }
  return (data ?? []).some((row) => (row as { id: string }).id !== excludeIntentId);
}

export async function processBotVoucher(input: {
  session: SessionUser;
  intentId: string;
  file: File;
}): Promise<BotVoucherResult> {
  const { session, file } = input;

  const intent = await getPaymentIntentByIdInternal(input.intentId);
  if (
    !intent ||
    intent.organizationId !== session.organizationId ||
    !isRecord(intent.metadata) ||
    intent.metadata.source !== RECHARGE_BOT_SOURCE
  ) {
    throw new RechargeBotUserError("No encontré esa recarga. Escribe «quiero recargar» para empezar una.");
  }

  if (intent.status === "succeeded") {
    return {
      intent: { id: intent.id, status: intent.status },
      replies: ["Esa recarga ya estaba acreditada. El saldo está en tu cartera."],
    };
  }
  if (intent.status !== "requires_payment" && intent.status !== "processing") {
    throw new RechargeBotUserError("Esa recarga ya se cerró. Si ya pagaste, escríbeme y un gerente la revisa.");
  }
  if (getString(intent.metadata.voucher_content_hash)) {
    return {
      intent: { id: intent.id, status: intent.status },
      replies: [
        "Ya tengo un comprobante para esta recarga.",
        "Estoy esperando la confirmación del banco. No vuelvas a pagar.",
      ],
    };
  }

  if (file.size <= 0) throw new RechargeBotUserError("La imagen llegó vacía. Vuelve a adjuntarla.");
  if (file.size > MAX_PROOF_BYTES) throw new RechargeBotUserError("El comprobante no puede pasar de 10 MB.");
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    throw new RechargeBotUserError("Adjunta la captura en JPG, PNG, WEBP o PDF.");
  }

  const rateLimits = await checkVoucherUploadRateLimits(intent.organizationId);
  if (!rateLimits.uploadAllowed) {
    throw new RechargeBotUserError(
      rateLimits.reason ?? "Se enviaron demasiados comprobantes. Inténtalo en un rato.",
    );
  }

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const safeName = sanitizeFileName(file.name || "comprobante");
  const storagePath = `${intent.organizationId}/${intent.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await admin.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
  if (uploadError) {
    console.error("[recharge-bot/voucher] no se pudo guardar", uploadError.message);
    throw new RechargeBotUserError("No pude guardar tu comprobante. Inténtalo de nuevo.");
  }

  const metadata = intent.metadata;
  const expectedPenCents = getNumber(metadata.gross_pen_cents) ?? intent.amountCents;
  const contentHash = hashVoucherBuffer(buffer);

  const analysis = await analyzePaymentVoucher({
    buffer,
    mimeType,
    expectedAmount: expectedPenCents / 100,
    expectedCurrency: "PEN",
    holderNames: [YAPE_RECIPIENT.holder],
    strictCurrency: true,
  });

  const duplicateHash = await isDuplicateVoucherHash(contentHash, intent.id);
  const operationCode = normalizeOperationCode(analysis.operationCode);
  const duplicateOperationCode = operationCode
    ? await isDuplicateOperationCode(operationCode, intent.id)
    : false;

  const security: VoucherSecurityFlags = {
    duplicateContentHash: duplicateHash,
    duplicateOperationCode,
    rateLimitBlocksAutoApprove: !rateLimits.autoApproveAllowed,
    uploadRateLimited: false,
  };

  if (duplicateHash) {
    analysis.confirmed = false;
    analysis.needsReview = true;
    analysis.reason = "Este comprobante ya fue usado en otro pago.";
  } else if (duplicateOperationCode) {
    analysis.confirmed = false;
    analysis.needsReview = true;
    analysis.reason = "Este código de operación ya fue registrado en otro pago.";
  }

  const submittedAt = new Date().toISOString();
  await updatePaymentIntentRecord(intent.id, {
    status: "processing",
    metadata: mergeMetadata(metadata, {
      manual_review_status: "pending_review",
      voucher_content_hash: contentHash,
      ...(operationCode ? { voucher_operation_code: operationCode } : {}),
      voucher_security: security,
      manual_proof: {
        bucket: PAYMENT_PROOFS_BUCKET,
        path: storagePath,
        file_name: safeName,
        mime_type: mimeType,
        size_bytes: buffer.length,
        submitted_at: submittedAt,
        submitted_by: session.id,
      },
      // A diferencia de la recarga manual, aquí se guarda el resultado real:
      // es una de las dos pruebas que exige el cierre automático.
      voucher_analysis: analysis,
      voucher_analyzed_at: submittedAt,
    }),
  });

  await admin.from("audit_logs").insert({
    organization_id: intent.organizationId,
    actor_user_id: session.id,
    action: "payment_intent.proof_uploaded",
    entity_type: "payment_intent",
    entity_id: intent.id,
    metadata: { bucket: PAYMENT_PROOFS_BUCKET, path: storagePath, source: RECHARGE_BOT_SOURCE },
  });

  // Si el aviso del banco llegó antes que la captura, se cierra ahora mismo.
  const bankNotificationId = getString(metadata.bank_confirmation_notification_id);
  if (analysis.confirmed && getString(metadata.bank_confirmed_at) && bankNotificationId) {
    await completeBankConfirmedDeposit({
      intentId: intent.id,
      notificationId: bankNotificationId,
      operationNumber: getString(metadata.bank_confirmation_operation_number),
    });
  } else if (analysis.confirmed) {
    // Revisa el correo del banco en el momento en vez de esperar al cron.
    try {
      await pollYapeMailboxThrottled();
    } catch (error) {
      console.warn("[recharge-bot/voucher] revisión inmediata del correo falló", error);
    }
  }

  const fresh = await getPaymentIntentByIdInternal(intent.id);
  const status = fresh?.status ?? "processing";

  if (status === "succeeded") {
    return {
      intent: { id: intent.id, status },
      replies: ["🎉 ¡Listo! Confirmé tu pago y el saldo ya está en tu cartera."],
    };
  }

  if (analysis.confirmed) {
    return {
      intent: { id: intent.id, status },
      replies: [
        "⏳ Recibí tu comprobante y se ve bien.",
        "Ahora espero la confirmación del banco, suele tardar uno o dos minutos. Te aviso aquí mismo apenas entre el saldo.",
        "No vuelvas a pagar.",
      ],
    };
  }

  // No se pudo validar solo: pasa a un gerente, que ve la recarga en su cola.
  try {
    const { notifyManagersManualPaymentPendingBestEffort } = await import(
      "@/lib/email/manual-payment-notify.server"
    );
    await notifyManagersManualPaymentPendingBestEffort({
      paymentIntentId: intent.id,
      organizationId: intent.organizationId,
      createdBy: intent.createdBy,
      chargeAmountCents: expectedPenCents,
      chargeCurrency: "PEN",
      creditUsdCents: getNumber(metadata.credit_amount_cents) ?? 0,
      operationCode,
      purpose: null,
    });
  } catch (error) {
    console.warn("[recharge-bot/voucher] aviso a gerentes falló", error);
  }

  return {
    intent: { id: intent.id, status },
    replies: [
      "Recibí tu comprobante, pero no lo pude validar solo.",
      ...(analysis.reason ? [`Motivo: ${analysis.reason}`] : []),
      "Un gerente lo va a revisar y te avisamos. No vuelvas a pagar.",
    ],
  };
}
