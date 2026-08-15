import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  listInboxTicketMessagesForAgent,
  replyInboxTicket,
  updateInboxTicketStatus,
} from "@/lib/support/support-inbox.server";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function assertStaff(email: string, role: string | null | undefined) {
  const funding = resolvePaymentsFundingCapabilities({ email, role });
  return funding.isStaff || funding.isSuperAdmin;
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

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!assertStaff(session.email, session.role)) {
    return NextResponse.json({ error: "Solo gerentes." }, { status: 403 });
  }

  const { id } = await context.params;
  const messages = await listInboxTicketMessagesForAgent(id);
  return NextResponse.json({ ok: true, messages });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!assertStaff(session.email, session.role)) {
    return NextResponse.json({ error: "Solo gerentes." }, { status: 403 });
  }

  const { id } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    let messageText = "";
    let status: string | undefined;
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawMessage = formData.get("message");
      const rawStatus = formData.get("status");
      messageText = typeof rawMessage === "string" ? rawMessage : "";
      status = typeof rawStatus === "string" ? rawStatus : undefined;
      files = collectFiles(formData);
    } else {
      const body = (await request.json()) as {
        message?: string;
        status?: string;
      };
      messageText = body.message ?? "";
      status = body.status;
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Máximo ${MAX_FILES} archivos.` },
        { status: 400 },
      );
    }
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `"${file.name}" supera 10 MB.` },
          { status: 400 },
        );
      }
      if (file.type && !ALLOWED_MIME.has(file.type)) {
        return NextResponse.json(
          { error: `Formato no permitido: ${file.name}` },
          { status: 400 },
        );
      }
    }

    // Solo cambiar estado sin mensaje
    if (!messageText.trim() && files.length === 0 && status) {
      await updateInboxTicketStatus({
        session,
        ticketId: id,
        status,
      });
      return NextResponse.json({ ok: true, updated: true });
    }

    const message = await replyInboxTicket({
      session,
      ticketId: id,
      message: messageText,
      files,
      status,
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "No se pudo responder.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
