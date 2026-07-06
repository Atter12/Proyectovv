import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import type { SessionUser } from "@/types/auth";
import type { ChatMessage } from "@/features/support/types/support.types";

export interface SupportTicketSummary {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

interface SupportMessageRow {
  id: string;
  body: string;
  sender_user_id: string | null;
  internal_note: boolean;
  created_at: string;
}

function toChatMessage(row: SupportMessageRow, session: SessionUser): ChatMessage {
  return {
    id: row.id,
    role: row.sender_user_id === session.id ? "user" : "bot",
    text: row.body,
    timestamp: new Date(row.created_at).toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    }),
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
  input: { subject: string; message: string },
): Promise<{ ticketId: string; message: ChatMessage }> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: ticket, error: ticketError } = await admin
    .from("support_tickets")
    .insert({
      organization_id: session.organizationId,
      requester_user_id: session.id,
      subject: input.subject.trim() || "Consulta de soporte",
      status: "open",
      priority: "normal",
      category: "chat",
      metadata: { source: "floating_chat" },
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
      body: input.message.trim(),
      attachments: [],
      internal_note: false,
    })
    .select("id, body, sender_user_id, internal_note, created_at")
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

  return { ticketId: ticket.id, message: toChatMessage(message, session) };
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
    .select("id, body, sender_user_id, internal_note, created_at")
    .eq("ticket_id", ticketId)
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: true });

  if (!canSeeInternal) {
    query = query.eq("internal_note", false);
  }

  const { data, error } = await query;
  if (error) return [];

  return ((data ?? []) as SupportMessageRow[]).map((row) =>
    toChatMessage(row, session),
  );
}

export async function postTicketMessage(
  session: SessionUser,
  ticketId: string,
  body: string,
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

  const { data, error } = await admin
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      organization_id: session.organizationId,
      sender_user_id: session.id,
      body: body.trim(),
      attachments: [],
      internal_note: false,
    })
    .select("id, body, sender_user_id, internal_note, created_at")
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
