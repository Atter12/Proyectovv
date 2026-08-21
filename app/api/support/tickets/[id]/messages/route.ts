import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createSupportTicket,
  clearSupportTicketChat,
  listTicketMessages,
  postTicketMessage,
  uploadSupportAttachment,
  type SupportAttachmentInput,
} from "@/services/support.service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  const messages = await listTicketMessages(session, id);
  return NextResponse.json({ ok: true, messages });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    let messageText = "";
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawMessage = formData.get("message");
      messageText = typeof rawMessage === "string" ? rawMessage : "";
      files = collectFiles(formData);
    } else {
      const body = (await request.json()) as { message?: string };
      messageText = body.message ?? "";
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

    const attachments: SupportAttachmentInput[] = [];
    for (const file of files) {
      attachments.push(await uploadSupportAttachment(session, id, file));
    }

    const message = await postTicketMessage(
      session,
      id,
      messageText,
      attachments,
    );
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "No se pudo enviar el mensaje.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "support:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const result = await clearSupportTicketChat({
      ticketId: id,
      organizationId: session.organizationId,
      asStaff: false,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "No se pudo borrar el chat.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
