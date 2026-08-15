import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createSupportTicket,
  createSupportTicketShell,
  listSupportTickets,
  postTicketMessage,
  uploadSupportAttachment,
  type SupportAttachmentInput,
} from "@/services/support.service";
import { notifySupportTicketCreated } from "@/lib/email/email.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function collectFiles(formData: FormData): File[] {
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (!(value instanceof File) || value.size <= 0) continue;
    if (key === "files" || key === "file" || key.startsWith("file")) {
      files.push(value);
    }
  }
  return files;
}

function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) {
    return `Máximo ${MAX_FILES} archivos por mensaje.`;
  }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return `"${file.name}" supera 10 MB.`;
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return `"${file.name}" no permitido. Usá JPG, PNG, WEBP, GIF o PDF.`;
    }
  }
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const tickets = await listSupportTickets(session);
  return NextResponse.json({ ok: true, tickets });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    let messageText = "";
    let subject = "Consulta de soporte";
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawMessage = formData.get("message");
      const rawSubject = formData.get("subject");
      messageText = typeof rawMessage === "string" ? rawMessage : "";
      if (typeof rawSubject === "string" && rawSubject.trim()) {
        subject = rawSubject.trim();
      }
      files = collectFiles(formData);
    } else {
      const body = (await request.json()) as {
        subject?: string;
        message?: string;
      };
      messageText = body.message ?? "";
      if (body.subject?.trim()) subject = body.subject.trim();
    }

    const fileError = validateFiles(files);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    if (!messageText.trim() && files.length === 0) {
      return NextResponse.json(
        { error: "Mensaje o adjunto requerido." },
        { status: 400 },
      );
    }

    let ticketId: string;
    let message;

    if (files.length === 0) {
      const result = await createSupportTicket(session, {
        subject,
        message: messageText,
      });
      ticketId = result.ticketId;
      message = result.message;
    } else {
      ticketId = await createSupportTicketShell(session, subject);
      const attachments: SupportAttachmentInput[] = [];
      for (const file of files) {
        attachments.push(await uploadSupportAttachment(session, ticketId, file));
      }
      message = await postTicketMessage(
        session,
        ticketId,
        messageText,
        attachments,
      );
      if (session.organizationId) {
        await createNotificationBestEffort({
          organizationId: session.organizationId,
          title: "Nuevo ticket de soporte",
          body: subject,
          type: "support_ticket_created",
          data: { ticket_id: ticketId, url: "/support" },
        });
      }
    }

    try {
      await notifySupportTicketCreated({
        requesterEmail: session.email,
        organizationId: session.organizationId,
        userId: session.id,
        ticketId,
        subject,
      });
    } catch (emailError) {
      console.error("[support] no se pudo enviar email del ticket", emailError);
    }

    return NextResponse.json({
      ok: true,
      ticketId,
      message,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el ticket.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
