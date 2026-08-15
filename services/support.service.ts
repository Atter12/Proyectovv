import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import type { SessionUser } from "@/types/auth";
import type {
  ChatAttachment,
  ChatMessage,
} from "@/features/support/types/support.types";

export const SUPPORT_ATTACHMENTS_BUCKET = "support-attachments";

export interface SupportTicketSummary {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface SupportAttachmentInput {
  name: string;
  mimeType: string;
  path: string;
  bucket: string;
  size: number;
}

interface SupportMessageRow {
  id: string;
  body: string;
  sender_user_id: string | null;
  internal_note: boolean;
  created_at: string;
  attachments?: unknown;
}

function parseAttachments(raw: unknown): SupportAttachmentInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name : null;
      const path = typeof row.path === "string" ? row.path : null;
      const bucket =
        typeof row.bucket === "string" ? row.bucket : SUPPORT_ATTACHMENTS_BUCKET;
      const mimeType =
        typeof row.mime_type === "string"
          ? row.mime_type
          : typeof row.mimeType === "string"
            ? row.mimeType
            : "application/octet-stream";
      const size = typeof row.size === "number" ? row.size : 0;
      if (!name || !path) return null;
      return { name, mimeType, path, bucket, size };
    })
    .filter((item): item is SupportAttachmentInput => Boolean(item));
}

async function withSignedUrls(
  attachments: SupportAttachmentInput[],
): Promise<ChatAttachment[]> {
  if (attachments.length === 0) return [];
  const admin = createAdminClient();
  return Promise.all(
    attachments.map(async (attachment) => {
      const { data } = await admin.storage
        .from(attachment.bucket)
        .createSignedUrl(attachment.path, 60 * 60);
      return {
        name: attachment.name,
        mimeType: attachment.mimeType,
        path: attachment.path,
        bucket: attachment.bucket,
        size: attachment.size,
        url: data?.signedUrl ?? null,
      };
    }),
  );
}

async function toChatMessage(
  row: SupportMessageRow,
  session: SessionUser,
): Promise<ChatMessage> {
  const attachments = await withSignedUrls(parseAttachments(row.attachments));
  return {
    id: row.id,
    role: row.sender_user_id === session.id ? "user" : "bot",
    text: row.body,
    timestamp: new Date(row.created_at).toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    attachments,
  };
}

export async function listSupportTickets(
  session: SessionUser,
): Promise<SupportTicketSummary[]> {
  if (!session.organizationId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at, updated_at")
    .eq("organization_id", session.organizationId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createSupportTicket(
  session: SessionUser,
  input: {
    subject: string;
    message: string;
    attachments?: SupportAttachmentInput[];
  },
): Promise<{ ticketId: string; message: ChatMessage }> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const attachments = input.attachments ?? [];
  const bodyText =
    input.message.trim() || (attachments.length ? "📎 Adjunto" : "");
  if (!bodyText) {
    throw new Error("Mensaje o adjunto requerido.");
  }

  const { data: ticket, error: ticketError } = await admin
    .from("support_tickets")
    .insert({
      organization_id: session.organizationId,
      requester_user_id: session.id,
      subject: input.subject.trim() || "Consulta de soporte",
      status: "open",
      priority: "normal",
      category: "chat",
      metadata: { source: "support_chat" },
      updated_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (ticketError || !ticket) {
    throw new Error(ticketError?.message ?? "No se pudo crear el ticket.");
  }

  const { data: message, error: messageError } = await admin
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      organization_id: session.organizationId,
      sender_user_id: session.id,
      body: bodyText,
      attachments: attachments.map((item) => ({
        name: item.name,
        mime_type: item.mimeType,
        path: item.path,
        bucket: item.bucket,
        size: item.size,
      })),
      internal_note: false,
    })
    .select("id, body, sender_user_id, internal_note, created_at, attachments")
    .single<SupportMessageRow>();

  if (messageError || !message) {
    throw new Error(messageError?.message ?? "No se pudo guardar el mensaje.");
  }

  await createNotificationBestEffort({
    organizationId: session.organizationId,
    title: "Nuevo ticket de soporte",
    body: input.subject.trim() || "Consulta de soporte",
    type: "support_ticket_created",
    data: { ticket_id: ticket.id, url: "/support" },
  });

  return {
    ticketId: ticket.id,
    message: await toChatMessage(message, session),
  };
}

/** Crea solo el ticket (sin mensaje) para poder subir adjuntos con su id. */
export async function createSupportTicketShell(
  session: SessionUser,
  subject = "Consulta de soporte",
): Promise<string> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({
      organization_id: session.organizationId,
      requester_user_id: session.id,
      subject: subject.trim() || "Consulta de soporte",
      status: "open",
      priority: "normal",
      category: "chat",
      metadata: { source: "support_chat" },
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !ticket) {
    throw new Error(error?.message ?? "No se pudo crear el ticket.");
  }
  return ticket.id;
}

export async function listTicketMessages(
  session: SessionUser,
  ticketId: string,
): Promise<ChatMessage[]> {
  if (!session.organizationId) return [];

  const supabase = await createClient();
  const canSeeInternal =
    session.role === "owner" ||
    session.role === "admin" ||
    session.role === "support";

  let query = supabase
    .from("support_messages")
    .select("id, body, sender_user_id, internal_note, created_at, attachments")
    .eq("ticket_id", ticketId)
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: true });

  if (!canSeeInternal) {
    query = query.eq("internal_note", false);
  }

  const { data, error } = await query;
  if (error) return [];

  return Promise.all(
    ((data ?? []) as SupportMessageRow[]).map((row) =>
      toChatMessage(row, session),
    ),
  );
}

export async function postTicketMessage(
  session: SessionUser,
  ticketId: string,
  body: string,
  attachments: SupportAttachmentInput[] = [],
): Promise<ChatMessage> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("organization_id", session.organizationId)
    .maybeSingle<{ id: string; status: string }>();

  if (!ticket) {
    throw new Error("Ticket no encontrado.");
  }
  if (["closed", "resolved"].includes(ticket.status)) {
    throw new Error("Este ticket ya está cerrado.");
  }

  const trimmed = body.trim();
  if (!trimmed && attachments.length === 0) {
    throw new Error("Mensaje o adjunto requerido.");
  }

  const { data, error } = await admin
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      organization_id: session.organizationId,
      sender_user_id: session.id,
      body: trimmed || "📎 Adjunto",
      attachments: attachments.map((item) => ({
        name: item.name,
        mime_type: item.mimeType,
        path: item.path,
        bucket: item.bucket,
        size: item.size,
      })),
      internal_note: false,
    })
    .select("id, body, sender_user_id, internal_note, created_at, attachments")
    .single<SupportMessageRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo enviar el mensaje.");
  }

  await admin
    .from("support_tickets")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("organization_id", session.organizationId);

  return toChatMessage(data, session);
}

export async function uploadSupportAttachment(
  session: SessionUser,
  ticketId: string,
  file: File,
): Promise<SupportAttachmentInput> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id")
    .eq("id", ticketId)
    .eq("organization_id", session.organizationId)
    .maybeSingle<{ id: string }>();

  if (!ticket) {
    throw new Error("Ticket no encontrado.");
  }

  const safeName =
    file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || "adjunto";

  const path = `${session.organizationId}/${ticketId}/${Date.now()}-${safeName}`;
  const { error } = await admin.storage
    .from(SUPPORT_ATTACHMENTS_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(
      error.message ||
        "No se pudo subir el archivo. Verificá el bucket support-attachments.",
    );
  }

  return {
    name: safeName,
    mimeType: file.type || "application/octet-stream",
    path,
    bucket: SUPPORT_ATTACHMENTS_BUCKET,
    size: file.size,
  };
}
