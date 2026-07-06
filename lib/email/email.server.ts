import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  templateKey: string;
  organizationId?: string | null;
  userId?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

interface ResendSendResponse {
  id?: string;
  error?: {
    message?: string;
    name?: string;
  };
}

function normalizeRecipients(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

async function insertEmailEvent(input: SendEmailInput, status: string, patch: Record<string, unknown> = {}) {
  const recipients = normalizeRecipients(input.to);
  const admin = createAdminClient();

  await Promise.all(
    recipients.map((email) =>
      admin.from("email_events").insert({
        organization_id: input.organizationId ?? null,
        user_id: input.userId ?? null,
        provider: serverEnv.emailProvider,
        email,
        template_key: input.templateKey,
        status,
        subject: input.subject,
        ...(patch.provider_message_id ? { provider_message_id: String(patch.provider_message_id) } : {}),
        metadata: {
          ...(input.metadata ?? {}),
          idempotency_key: input.idempotencyKey ?? null,
          ...patch,
        },
        ...(status === "queued" ? { queued_at: new Date().toISOString() } : {}),
        ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
        ...(status === "failed" ? { error_message: String(patch.error_message ?? "Error enviando email") } : {}),
      }),
    ),
  );
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<{ sent: boolean; providerMessageId?: string }> {
  const recipients = normalizeRecipients(input.to).filter(Boolean);
  if (recipients.length === 0) {
    return { sent: false };
  }

  if (serverEnv.emailProvider !== "resend" || !serverEnv.resendApiKey) {
    await insertEmailEvent(input, "queued", {
      reason: "email_provider_not_configured",
    });
    return { sent: false };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.resendApiKey}`,
    "Content-Type": "application/json",
    "User-Agent": `${serverEnv.appName}/1.0`,
  };

  if (input.idempotencyKey) {
    headers["Idempotency-Key"] = input.idempotencyKey.slice(0, 256);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: serverEnv.emailFrom,
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(serverEnv.emailReplyTo ? { reply_to: serverEnv.emailReplyTo } : {}),
      tags: [
        { name: "template", value: input.templateKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) },
      ],
    }),
  });

  const data = (await response.json().catch(() => ({}))) as ResendSendResponse;
  if (!response.ok || data.error) {
    const message = data.error?.message ?? `Resend respondió ${response.status}`;
    await insertEmailEvent(input, "failed", { error_message: message });
    throw new Error(message);
  }

  await insertEmailEvent(input, "sent", { provider_message_id: data.id ?? null });
  return { sent: true, providerMessageId: data.id };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notifySupportTicketCreated(input: {
  requesterEmail: string;
  organizationId?: string | null;
  userId?: string | null;
  ticketId: string;
  subject: string;
}): Promise<void> {
  const safeSubject = escapeHtml(input.subject);
  const dashboardUrl = `${serverEnv.appUrl.replace(/\/$/, "")}/support`;

  await sendTransactionalEmail({
    to: input.requesterEmail,
    subject: `Ticket recibido: ${input.subject}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h1 style="font-size:22px;margin:0 0 12px">Recibimos tu ticket</h1>
        <p>Tu solicitud <strong>${safeSubject}</strong> fue registrada correctamente.</p>
        <p>El equipo de soporte revisará el caso y te responderá lo antes posible.</p>
        <p><a href="${dashboardUrl}" style="display:inline-block;background:#4056ff;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">Ver soporte</a></p>
      </div>
    `,
    text: `Recibimos tu ticket: ${input.subject}. Puedes revisarlo en ${dashboardUrl}`,
    templateKey: "support.ticket.created",
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    idempotencyKey: `email:support_ticket_created:${input.ticketId}`,
    metadata: { ticket_id: input.ticketId },
  });

  if (serverEnv.supportEmail && serverEnv.supportEmail !== input.requesterEmail) {
    await sendTransactionalEmail({
      to: serverEnv.supportEmail,
      subject: `Nuevo ticket de soporte: ${input.subject}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h1 style="font-size:22px;margin:0 0 12px">Nuevo ticket de soporte</h1>
          <p><strong>Asunto:</strong> ${safeSubject}</p>
          <p><strong>Solicitante:</strong> ${escapeHtml(input.requesterEmail)}</p>
          <p><a href="${dashboardUrl}" style="display:inline-block;background:#4056ff;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">Abrir soporte</a></p>
        </div>
      `,
      text: `Nuevo ticket de soporte. Asunto: ${input.subject}. Solicitante: ${input.requesterEmail}.`,
      templateKey: "support.ticket.created.internal",
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      idempotencyKey: `email:support_ticket_created_internal:${input.ticketId}`,
      metadata: { ticket_id: input.ticketId, requester_email: input.requesterEmail },
    });
  }
}
