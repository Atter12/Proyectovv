import "server-only";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import {
  manualPaymentApprovedClientTemplate,
  manualPaymentPendingManagerTemplate,
  type ManualPaymentPendingKind,
} from "@/lib/email/templates/payments";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format-money";
import { getNumber, getString, isRecord } from "@/lib/records";
import { getPaymentIntentByIdInternal } from "@/lib/payments/payment-intents.server";
import { getManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import { RECHARGE_BOT_SOURCE, YAPE_RECIPIENT } from "@/lib/payments/yape/recipient";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { listHecomOtpStaffEmails } from "@/lib/auth/hecom-otp.server";
import {
  describeVoucherChannel,
  normalizeVoucherBank,
  normalizeVoucherChannel,
} from "@/lib/payments/voucher-channel";

function uniqueEmails(list: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const email = String(raw ?? "")
      .trim()
      .toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    if (email.includes("example.com")) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/** Siempre incluido aunque falte en Vercel env (ops principal). */
const MANUAL_PAYMENT_MANAGER_FALLBACKS = [
  "attermayerbasiliorengifo@gmail.com",
  "popo258789@gmail.com",
  "templesour@icloud.com",
] as const;

/**
 * Gerentes / ops que deben enterarse de pagos manuales pendientes: los mismos
 * que pueden entrar como gerente (lista fija + env), aunque falten en Vercel.
 */
export function resolveManualPaymentManagerEmails(): string[] {
  return uniqueEmails([
    ...MANUAL_PAYMENT_MANAGER_FALLBACKS,
    ...listHecomOtpStaffEmails(),
    ...serverEnv.paymentsSuperAdminEmails,
    serverEnv.supportEmail,
  ]);
}

async function resolveUserEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle<{ email: string | null; full_name: string | null }>();
  return data?.email?.trim() || null;
}

async function resolveProfile(
  userId: string | null,
): Promise<{ email: string | null; fullName: string | null }> {
  if (!userId) return { email: null, fullName: null };
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle<{ full_name: string | null; email: string | null }>();
  return {
    email: data?.email?.trim() || null,
    fullName: data?.full_name?.trim() || null,
  };
}

/**
 * Nombre real del cliente Hecom (el que gerencia ve en admin). El nombre de
 * perfil suele ser un usuario tipo "dra.anamaria2026" y no sirve para conciliar.
 */
async function resolveHecomCliente(
  metadata: Record<string, unknown>,
  userId: string | null,
): Promise<{ id: string | null; name: string | null }> {
  let id = getString(metadata.hecom_cliente_id);
  const storedName = getString(metadata.hecom_cliente_name);
  if (id && storedName) return { id, name: storedName };

  if (!id && userId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("hecom_cliente_user_links")
      .select("hecom_cliente_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle<{ hecom_cliente_id: string | null }>();
    id = data?.hecom_cliente_id ? String(data.hecom_cliente_id) : null;
  }
  if (!id) return { id: null, name: storedName };

  const cliente = await getHecomCliente(id).catch(() => null);
  return { id, name: cliente?.name?.trim() || storedName };
}

/**
 * Medio de pago tal como lo muestra el voucher (Yape, Plin · Interbank,
 * Transferencia interbancaria · BBVA, Binance Pay…). Si la IA no lo pudo leer,
 * cae a lo que el cliente eligió al subirlo.
 */
function resolvePayMethod(input: {
  provider: string;
  metadata: Record<string, unknown>;
  chargeCurrency: string;
  analysis: Record<string, unknown> | null;
}): { label: string; destination: string | null } {
  const { metadata } = input;
  const channel = normalizeVoucherChannel(getString(input.analysis?.paymentChannel));
  const bank = normalizeVoucherBank(getString(input.analysis?.originBank));
  const method = (
    getString(metadata.manual_pay_method) ??
    getString(metadata.pay_method) ??
    ""
  ).toLowerCase();

  if (getString(metadata.source) === RECHARGE_BOT_SOURCE) {
    return {
      label: describeVoucherChannel({ channel, bank }) ?? "Yape",
      destination: `Yape ${YAPE_RECIPIENT.phoneDisplay} · ${YAPE_RECIPIENT.holder}`,
    };
  }

  const isCrypto =
    input.provider === "crypto" ||
    method === "binance" ||
    channel === "binance" ||
    channel === "cripto";
  if (isCrypto) {
    return {
      label:
        describeVoucherChannel({ channel, bank }) ??
        (method === "binance" ? "Binance Pay" : "Cripto (USDT)"),
      destination: null,
    };
  }

  const currency = input.chargeCurrency === "PEN" ? "PEN" : "USD";
  const account = getManualBankAccounts(currency)[0];
  const detected = describeVoucherChannel({
    channel,
    bank,
    destinationBank: account?.bank ?? null,
  });
  const claimed = getString(metadata.claimed_metodo);
  return {
    label: detected ?? (claimed && method !== "bank" ? claimed : "Transferencia bancaria"),
    destination: account
      ? `${account.label} · ****${account.accountNumber.slice(-4)}`
      : null,
  };
}

const LIMA_DATE_TIME = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatLimaDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return LIMA_DATE_TIME.format(date).replace(",", " ·");
}

function formatVoucherDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const PROOF_SIGNED_URL_TTL_SECONDS = 72 * 60 * 60;
/** Resend acepta hasta 40 MB por correo; en base64 el archivo crece ~33 %. */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
/** El voucher incrustado viaja además del adjunto; por encima de esto, solo adjunto. */
const MAX_INLINE_BYTES = 4 * 1024 * 1024;
const INLINE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VOUCHER_CID = "voucher";

type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
  contentId?: string;
};

type ProofForEmail = {
  fileName: string;
  url: string | null;
  /** Copia descargable del voucher. */
  attachment: EmailAttachment | null;
  /** Copia incrustada que se ve en el cuerpo del correo. */
  inline: EmailAttachment | null;
};

/** Baja el voucher una sola vez para adjuntarlo en todos los correos. */
async function loadProofForEmail(
  metadata: Record<string, unknown>,
  baseName: string,
): Promise<ProofForEmail | null> {
  const proof = isRecord(metadata.manual_proof) ? metadata.manual_proof : null;
  const path = getString(proof?.path);
  if (!proof || !path) return null;
  const bucket = getString(proof.bucket) ?? "payment-proofs";
  const mimeType = getString(proof.mime_type) ?? undefined;
  const original = getString(proof.file_name) ?? path.split("/").pop() ?? "voucher";
  const ext = original.includes(".") ? original.split(".").pop()!.toLowerCase() : "jpg";
  const fileName = `${baseName}.${ext}`;

  const admin = createAdminClient();
  const [signed, download] = await Promise.all([
    admin.storage.from(bucket).createSignedUrl(path, PROOF_SIGNED_URL_TTL_SECONDS),
    admin.storage.from(bucket).download(path),
  ]);

  let attachment: ProofForEmail["attachment"] = null;
  let inline: ProofForEmail["inline"] = null;
  if (download.data && download.data.size <= MAX_ATTACHMENT_BYTES) {
    const buffer = Buffer.from(await download.data.arrayBuffer());
    const content = buffer.toString("base64");
    attachment = { filename: fileName, content, contentType: mimeType };
    if (
      mimeType &&
      INLINE_IMAGE_TYPES.has(mimeType) &&
      download.data.size <= MAX_INLINE_BYTES
    ) {
      inline = {
        filename: `vista-${fileName}`,
        content,
        contentType: mimeType,
        contentId: VOUCHER_CID,
      };
    }
  } else if (download.error) {
    console.warn("[email] voucher download failed", download.error.message);
  }

  return { fileName, url: signed.data?.signedUrl ?? null, attachment, inline };
}

function pendingKindFromPurpose(
  purpose: string | null | undefined,
): ManualPaymentPendingKind {
  if (purpose === "lo_pagado_deuda") return "debt";
  if (purpose === "hecom_missing_cobro") return "missing_cobro";
  if (purpose === "realprofit_cod") return "realprofit";
  return "wallet";
}

/** Cuando el cliente sube el voucher → avisar gerentes. */
export async function notifyManagersManualPaymentPendingBestEffort(input: {
  paymentIntentId: string;
  organizationId: string;
  createdBy: string | null;
  chargeAmountCents: number;
  chargeCurrency: string;
  creditUsdCents: number;
  operationCode?: string | null;
  /** realprofit_cod → /payments/profit; hecom_missing_cobro → /payments/missing-cobros */
  purpose?: string | null;
}): Promise<void> {
  const managers = resolveManualPaymentManagerEmails();
  if (managers.length === 0) {
    console.warn("[email] no manager emails for manual payment pending");
    return;
  }

  try {
    // Los tres llamadores guardan voucher y análisis en metadata antes de avisar.
    const intent = await getPaymentIntentByIdInternal(input.paymentIntentId);
    const metadata = (intent?.metadata ?? {}) as Record<string, unknown>;
    const [profile, hecom] = await Promise.all([
      resolveProfile(input.createdBy),
      resolveHecomCliente(metadata, input.createdBy),
    ]);

    const clientName =
      hecom.name || profile.fullName || profile.email || "Cliente sin nombre";

    const kind = pendingKindFromPurpose(input.purpose);
    const chargedLabel = formatMoney(
      input.chargeAmountCents / 100,
      input.chargeCurrency,
    );
    const creditLabel =
      kind === "wallet" && input.creditUsdCents > 0
        ? formatMoney(input.creditUsdCents / 100, "USD")
        : null;
    const feeCents =
      input.chargeCurrency === "USD"
        ? input.chargeAmountCents - input.creditUsdCents
        : 0;
    const feeLabel =
      creditLabel && feeCents > 0 ? formatMoney(feeCents / 100, "USD") : null;

    const analysis = isRecord(metadata.voucher_analysis) ? metadata.voucher_analysis : null;
    const payMethod = resolvePayMethod({
      provider: intent?.provider ?? "manual",
      metadata,
      chargeCurrency: input.chargeCurrency,
      analysis,
    });

    const operationCode =
      input.operationCode ??
      getString(metadata.voucher_operation_code) ??
      getString(metadata.claimed_operation_code);

    const security = isRecord(metadata.voucher_security) ? metadata.voucher_security : null;
    const proofMeta = isRecord(metadata.manual_proof) ? metadata.manual_proof : null;

    const alerts: string[] = [];
    if (security?.duplicateContentHash === true) {
      alerts.push("Este voucher ya se usó en otro pago acreditado.");
    }
    if (security?.duplicateOperationCode === true) {
      alerts.push("Este N° de operación ya está registrado en otro pago.");
    }

    const checks: Array<{ label: string; ok: boolean }> = [];
    const detectedAmount = getNumber(analysis?.detectedAmount);
    if (detectedAmount !== null) {
      const expected = input.chargeAmountCents / 100;
      const tolerance = input.chargeCurrency === "PEN" ? 1 : 0.5;
      checks.push({
        label: "Monto en voucher",
        ok: Math.abs(detectedAmount - expected) <= tolerance,
      });
    }
    if (typeof analysis?.beneficiaryMatch === "boolean") {
      checks.push({ label: "Beneficiario", ok: analysis.beneficiaryMatch });
    }

    const reviewReason =
      getString(analysis?.reason) ??
      (kind === "wallet"
        ? "El voucher aún no se cruzó con el abono del banco."
        : "Este tipo de pago siempre lo aprueba un gerente.");

    const submittedAtIso =
      getString(proofMeta?.submitted_at) ?? new Date().toISOString();
    const submittedAtLabel = formatLimaDateTime(submittedAtIso) ?? submittedAtIso;
    const paidAtLabel = formatVoucherDate(getString(analysis?.paymentDate));

    const base = serverEnv.appUrl.replace(/\/$/, "");
    const adminPath =
      kind === "missing_cobro"
        ? "/payments/missing-cobros"
        : kind === "realprofit"
          ? "/payments/profit"
          : "/payments/manual";
    const adminPathWithFilter = hecom.id
      ? `${adminPath}?cliente=${encodeURIComponent(hecom.id)}`
      : adminPath;
    const adminUrl = `${base}${adminPathWithFilter}`;

    const proof = await loadProofForEmail(
      metadata,
      [
        "voucher",
        slugify(clientName),
        operationCode ?? input.paymentIntentId.slice(0, 8),
      ]
        .filter(Boolean)
        .join("-"),
    ).catch((error) => {
      console.warn("[email] voucher for manager email failed", error);
      return null;
    });

    const template = manualPaymentPendingManagerTemplate({
      kind,
      clientName,
      clientEmail: profile.email,
      chargedLabel,
      payMethodLabel: payMethod.label,
      payerName: getString(analysis?.payerName),
      destinationLabel: payMethod.destination,
      operationCode,
      paidAtLabel,
      submittedAtLabel,
      creditLabel,
      feeLabel,
      reviewReason,
      checks,
      alerts,
      paymentIntentId: input.paymentIntentId,
      adminUrl,
      proof: proof
        ? {
            fileName: proof.fileName,
            attached: Boolean(proof.attachment),
            url: proof.url,
            inlineCid: proof.inline?.contentId ?? null,
          }
        : null,
    });

    const templateKey =
      kind === "missing_cobro"
        ? "payment.missing_cobro.pending_manager"
        : kind === "realprofit"
          ? "payment.realprofit.pending_manager"
          : "payment.manual.pending_manager";

    // Un correo por gerente (no batch). Gmail suele enterrar los TO múltiples.
    const results = await Promise.allSettled(
      managers.map((managerEmail) =>
        sendTransactionalEmail({
          to: managerEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
          templateKey,
          organizationId: input.organizationId,
          userId: input.createdBy,
          idempotencyKey: `email:manual_pending_mgr:${input.paymentIntentId}:${managerEmail}`,
          attachments: proof
            ? [proof.inline, proof.attachment].filter(
                (a): a is EmailAttachment => a !== null,
              )
            : undefined,
          metadata: {
            payment_intent_id: input.paymentIntentId,
            managers_count: managers.length,
            purpose: input.purpose ?? null,
            notify_mode: "per_recipient",
            voucher_attached: Boolean(proof?.attachment),
          },
        }),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error("[email] manual pending manager partial fail", {
        failed: failed.length,
        total: managers.length,
      });
    }

    const { sendWebPushToEmails } = await import("@/lib/push/send-web-push.server");
    await sendWebPushToEmails(managers, {
      title: "Nueva recarga por revisar",
      body: `${clientName} envió un comprobante de ${chargedLabel} por ${payMethod.label}.`,
      url: adminPathWithFilter,
    });
  } catch (error) {
    console.error("[email] manual pending manager notify failed", error);
  }
}

/** Cuando aprobamos el voucher → avisar al cliente. */
export async function notifyClientManualPaymentApprovedBestEffort(input: {
  paymentIntentId: string;
  organizationId: string;
  createdBy: string | null;
  chargeAmountCents: number;
  chargeCurrency: string;
  creditUsdCents: number;
}): Promise<void> {
  try {
    const to = await resolveUserEmail(input.createdBy);
    if (!to) {
      console.warn("[email] no client email for manual approval", {
        paymentIntentId: input.paymentIntentId,
      });
      return;
    }

    const chargedLabel = formatMoney(
      input.chargeAmountCents / 100,
      input.chargeCurrency,
    );
    const creditUsdLabel = formatMoney(input.creditUsdCents / 100, "USD");
    const template = manualPaymentApprovedClientTemplate({
      appName: serverEnv.appName,
      creditUsdLabel,
      chargedLabel,
      dashboardUrl: `${serverEnv.appUrl.replace(/\/$/, "")}/payments`,
    });

    await sendTransactionalEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      templateKey: "payment.manual.approved_client",
      organizationId: input.organizationId,
      userId: input.createdBy,
      idempotencyKey: `email:manual_approved_client:${input.paymentIntentId}`,
      metadata: { payment_intent_id: input.paymentIntentId },
    });
  } catch (error) {
    console.error("[email] manual approved client notify failed", error);
  }
}
