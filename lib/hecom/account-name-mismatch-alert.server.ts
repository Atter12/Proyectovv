import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import { resolveManualPaymentManagerEmails } from "@/lib/email/manual-payment-notify.server";
import { escapeHtml, wrapInternalEmail } from "@/lib/email/templates/layout";
import type { NameMismatch } from "@/lib/hecom/auto-map-tiktok-accounts.server";

/**
 * Avisa a soporte/gerencia cuando una cuenta TikTok se llama como otro cliente distinto
 * del vinculado en Hecom. Caso: Yim Villar 200.0 renombrada "Adriana Trujillo 207.0" en el BC
 * (el gasto se cobraba bien a Yim, pero nadie entendía de quién era).
 * Aviso al aparecer uno nuevo y luego cada 24 h mientras siga.
 */
const AUDIT_ACTION = "tiktok.name_mismatch_alert";
const REALERT_AFTER_HOURS = 24;
const MANAGER_EMAILS_PER_SECOND = 2;

function mismatchesHash(list: NameMismatch[]): string {
  const key = list.map((m) => `${m.advertiserId}:${m.name}`).sort().join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export async function alertNameMismatches(list: NameMismatch[]): Promise<{ alerted: boolean; reason: string }> {
  if (list.length === 0) return { alerted: false, reason: "sin_diferencias" };
  const admin = createAdminClient();
  const hash = mismatchesHash(list);

  const since = new Date(Date.now() - REALERT_AFTER_HOURS * 3_600_000).toISOString();
  const { data: recent } = await admin
    .from("audit_logs")
    .select("metadata")
    .eq("action", AUDIT_ACTION)
    .gte("created_at", since)
    .limit(50);
  if ((recent ?? []).some((r) => (r.metadata as { hash?: string } | null)?.hash === hash)) {
    return { alerted: false, reason: "ya_avisado" };
  }

  const managers = resolveManualPaymentManagerEmails();
  if (managers.length === 0) return { alerted: false, reason: "sin_destinatarios" };

  const subject = `[Revisar] ${list.length === 1 ? "1 cuenta TikTok tiene" : `${list.length} cuentas TikTok tienen`} el nombre de otro cliente`;
  const rowsHtml = list
    .map(
      (m) => `
        <tr>
          <td style="padding:10px 12px 10px 0;border-top:1px solid #e8e4dd;font-size:14px;color:#1a1917;vertical-align:top;">${escapeHtml(m.name)}<br /><span style="font-size:12px;color:#57524b;">ID ${escapeHtml(m.advertiserId)} · BM${escapeHtml(m.bm)}</span></td>
          <td style="padding:10px 0;border-top:1px solid #e8e4dd;font-size:14px;color:#1a1917;vertical-align:top;">${escapeHtml(m.linkedCliente)}</td>
          <td style="padding:10px 0 10px 12px;border-top:1px solid #e8e4dd;font-size:14px;color:#8f1d12;vertical-align:top;">${escapeHtml(m.nameCliente)}</td>
        </tr>`,
    )
    .join("");
  const bodyHtml = `
      <p style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:#1a1917;">Cuentas con el nombre de otro cliente</p>
      <p style="margin:10px 0 24px;font-size:15px;line-height:1.5;color:#57524b;">El gasto de estas cuentas se le cobra al cliente vinculado en Hecom, pero en TikTok se llaman como otro. Revisen las campañas para ver de quién es: si el vínculo está bien, cambien el nombre en el BC (TikTok no deja hacerlo por API); si no, cambien el vínculo en Hecom.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding:0 12px 8px 0;font-size:12px;color:#57524b;">Cuenta en TikTok</td>
          <td style="padding:0 0 8px;font-size:12px;color:#57524b;">Se le cobra a</td>
          <td style="padding:0 0 8px 12px;font-size:12px;color:#57524b;">El nombre dice</td>
        </tr>
        ${rowsHtml}
      </table>`;
  const html = wrapInternalEmail({
    label: "Cuentas TikTok",
    preview: subject,
    bodyHtml,
    footerNote: "Holistic Marketing · aviso interno para soporte y gerencia · revisión automática cada hora",
  });
  const text = [
    subject,
    ...list.map((m) => `${m.name} (ID ${m.advertiserId}, BM${m.bm}): se le cobra a ${m.linkedCliente}, el nombre dice ${m.nameCliente}.`),
  ].join("\n");

  const stamp = new Date().toISOString().slice(0, 13);
  let sent = 0;
  for (let i = 0; i < managers.length; i += MANAGER_EMAILS_PER_SECOND) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    const batch = await Promise.allSettled(
      managers.slice(i, i + MANAGER_EMAILS_PER_SECOND).map((to) =>
        sendTransactionalEmail({
          to,
          subject,
          html,
          text,
          templateKey: "ops.tiktok_name_mismatch.alert",
          idempotencyKey: `email:tiktok_name_mismatch:${hash}:${stamp}:${to}`,
          metadata: { hash, count: list.length },
        }),
      ),
    );
    sent += batch.filter((r) => r.status === "fulfilled").length;
  }
  if (sent === 0) return { alerted: false, reason: "envio_fallido" };

  await admin.from("audit_logs").insert({
    action: AUDIT_ACTION,
    entity_type: "ad_accounts",
    metadata: { hash, mismatched: list },
  });
  return { alerted: true, reason: "avisado" };
}
