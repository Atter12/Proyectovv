import "server-only";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import {
  manualPaymentApprovedClientTemplate,
  manualPaymentPendingManagerTemplate,
} from "@/lib/email/templates/payments";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format-money";

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

/** Gerentes / ops que deben enterarse de pagos manuales pendientes. */
export function resolveManualPaymentManagerEmails(): string[] {
  return uniqueEmails([
    ...serverEnv.authHecomOtpStaffEmails,
    ...serverEnv.adminAllowedEmails,
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

async function resolveUserName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle<{ full_name: string | null; email: string | null }>();
  return data?.full_name?.trim() || data?.email?.trim() || null;
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
  /** realprofit_cod → cola /payments/profit */
  purpose?: string | null;
}): Promise<void> {
  const managers = resolveManualPaymentManagerEmails();
  if (managers.length === 0) {
    console.warn("[email] no manager emails for manual payment pending");
    return;
  }

  try {
    const [clientEmail, clientName] = await Promise.all([
      resolveUserEmail(input.createdBy),
      resolveUserName(input.createdBy),
    ]);

    const amountLabel = formatMoney(
      input.chargeAmountCents / 100,
      input.chargeCurrency,
    );
    const creditUsdLabel = formatMoney(input.creditUsdCents / 100, "USD");
    const isRealProfit = input.purpose === "realprofit_cod";
    const base = serverEnv.appUrl.replace(/\/$/, "");
    const adminUrl = isRealProfit
      ? `${base}/payments/profit`
      : `${base}/payments/manual`;

    const template = manualPaymentPendingManagerTemplate({
      appName: serverEnv.appName,
      clientEmail,
      clientName,
      amountLabel,
      creditUsdLabel: isRealProfit
        ? "Real Profit COD (sin cartera)"
        : creditUsdLabel,
      paymentIntentId: input.paymentIntentId,
      adminUrl,
      operationCode: input.operationCode ?? null,
    });

    const subject = isRealProfit
      ? `[Profit COD] Pago $20 por revisar · ${clientName || clientEmail || "cliente"}`
      : template.subject;

    await sendTransactionalEmail({
      to: managers,
      subject,
      html: template.html,
      text: template.text,
      templateKey: isRealProfit
        ? "payment.realprofit.pending_manager"
        : "payment.manual.pending_manager",
      organizationId: input.organizationId,
      userId: input.createdBy,
      idempotencyKey: `email:manual_pending_mgr:${input.paymentIntentId}`,
      metadata: {
        payment_intent_id: input.paymentIntentId,
        managers_count: managers.length,
        purpose: input.purpose ?? null,
      },
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
