import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import type { ChatMessage } from "@/features/support/types/support.types";

export interface SupportTicketSummary {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
}

export async function listSupportTickets(
  session: SessionUser,
): Promise<SupportTicketSummary[]> {
  if (!session.organizationId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at")
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function createSupportTicket(
  session: SessionUser,
  input: { subject: string; message: string },
): Promise<{ ticketId: string }> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      organization_id: session.organizationId,
      created_by: session.id,
      subject: input.subject.trim() || "Consulta de soporte",
      status: "open",
    })
    .select("id")
    .single<{ id: string }>();

  if (ticketError || !ticket) {
    throw new Error(ticketError?.message ?? "No se pudo crear el ticket.");
  }

  const { error: messageError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    organization_id: session.organizationId,
    author_user_id: session.id,
    body: input.message.trim(),
    is_internal_note: false,
  });

  if (messageError) {
    throw new Error(messageError.message);
  }

  return { ticketId: ticket.id };
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
    .select("id, body, author_user_id, is_internal_note, created_at")
    .eq("ticket_id", ticketId)
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: true });

  if (!canSeeInternal) {
    query = query.eq("is_internal_note", false);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.author_user_id === session.id ? "user" : "bot",
    text: row.body,
    timestamp: new Date(row.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}

export async function postTicketMessage(
  session: SessionUser,
  ticketId: string,
  body: string,
): Promise<ChatMessage> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      organization_id: session.organizationId,
      author_user_id: session.id,
      body: body.trim(),
      is_internal_note: false,
    })
    .select("id, body, created_at")
    .single<{ id: string; body: string; created_at: string }>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo enviar el mensaje.");
  }

  return {
    id: data.id,
    role: "user",
    text: data.body,
    timestamp: new Date(data.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
