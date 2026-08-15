import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import type { SessionUser } from "@/types/auth";
import type {
  ChatAttachment,
  ChatMessage,
} from "@/features/support/types/support.types";
import {
  SUPPORT_ATTACHMENTS_BUCKET,
  type SupportAttachmentInput,
} from "@/services/support.service";

async function uploadInboxAttachment(
  ticketId: string,
  file: File,
): Promise<SupportAttachmentInput> {
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, organization_id")
    .eq("id", ticketId)
    .maybeSingle<{ id: string; organization_id: string | null }>();

  if (!ticket) throw new Error("Ticket no encontrado.");

  const orgPart = ticket.organization_id ?? "global";
  const safeName =
    file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || "adjunto";

  const path = `${orgPart}/${ticketId}/${Date.now()}-${safeName}`;
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

export interface InboxTicketItem {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  updatedAt: string | null;
  organizationId: string | null;
  organizationName: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
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

export async function listInboxTickets(filters?: {
  status?: string;
  q?: string;
  assignedUserId?: string;
}): Promise<InboxTicketItem[]> {
  const admin = createAdminClient();
  let query = admin
    .from("support_tickets")
    .select(
      "id, organization_id, requester_user_id, assigned_user_id, subject, status, priority, category, created_at, updated_at",
    )
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (filters?.status && filters.status !== "all") {
    if (filters.status === "active") {
      query = query.in("status", ["open", "pending"]);
    } else if (filters.status === "unassigned") {
      query = query.in("status", ["open", "pending"]).is("assigned_user_id", null);
    } else if (filters.status === "mine" && filters.assignedUserId) {
      query = query
        .in("status", ["open", "pending"])
        .eq("assigned_user_id", filters.assignedUserId);
    } else if (filters.status !== "mine") {
      query = query.eq("status", filters.status);
    }
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const orgIds = [
    ...new Set(
      data
        .map((row) => row.organization_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const userIds = [
    ...new Set(
      data
        .flatMap((row) => [
          row.requester_user_id as string | null,
          row.assigned_user_id as string | null,
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: orgs }, { data: profiles }] = await Promise.all([
    orgIds.length
      ? admin.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    userIds.length
      ? admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; email: string | null; full_name: string | null }>,
        }),
  ]);

  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { email: p.email, name: p.full_name },
    ]),
  );

  let items: InboxTicketItem[] = data.map((row) => {
    const requester = row.requester_user_id
      ? profileMap.get(row.requester_user_id as string)
      : undefined;
    const assignee = row.assigned_user_id
      ? profileMap.get(row.assigned_user_id as string)
      : undefined;
    return {
      id: row.id as string,
      subject: row.subject as string,
      status: row.status as string,
      priority: (row.priority as string) ?? "normal",
      category: (row.category as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: (row.updated_at as string | null) ?? null,
      organizationId: (row.organization_id as string | null) ?? null,
      organizationName: row.organization_id
        ? (orgMap.get(row.organization_id as string) ?? null)
        : null,
      requesterEmail: requester?.email ?? null,
      requesterName: requester?.name ?? null,
      assignedUserId: (row.assigned_user_id as string | null) ?? null,
      assignedUserName: assignee?.name ?? null,
      assignedUserEmail: assignee?.email ?? null,
    };
  });

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    items = items.filter((item) =>
      [
        item.subject,
        item.organizationName,
        item.requesterEmail,
        item.requesterName,
        item.assignedUserName,
        item.assignedUserEmail,
        item.category,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }

  if (filters?.status === "unassigned") {
    items = items.filter((item) => !item.assignedUserId);
  }
  if (filters?.status === "mine" && filters.assignedUserId) {
    items = items.filter((item) => item.assignedUserId === filters.assignedUserId);
  }

  return items;
}

export async function listInboxTicketMessages(
  ticketId: string,
  session: SessionUser,
): Promise<ChatMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_messages")
    .select("id, body, sender_user_id, internal_note, created_at, attachments")
    .eq("ticket_id", ticketId)
    .eq("internal_note", false)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return Promise.all(
    data.map(async (row) => {
      const attachments = await withSignedUrls(parseAttachments(row.attachments));
      return {
        id: row.id as string,
        role: row.sender_user_id === session.id ? "user" : "bot",
        text: row.body as string,
        timestamp: new Date(row.created_at as string).toLocaleTimeString("es", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        attachments,
      } satisfies ChatMessage;
    }),
  );
}

/** En vista gerente: mensajes del cliente = bot (izquierda), respuestas del staff = user (derecha). */
export async function listInboxTicketMessagesForAgent(
  ticketId: string,
): Promise<ChatMessage[]> {
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("requester_user_id")
    .eq("id", ticketId)
    .maybeSingle<{ requester_user_id: string | null }>();

  const { data, error } = await admin
    .from("support_messages")
    .select("id, body, sender_user_id, internal_note, created_at, attachments")
    .eq("ticket_id", ticketId)
    .eq("internal_note", false)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const requesterId = ticket?.requester_user_id ?? null;
  const senderIds = [
    ...new Set(
      data
        .map((row) => row.sender_user_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: profiles } = senderIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", senderIds)
    : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> };
  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p.full_name?.trim() || p.email?.split("@")[0] || "Agente",
    ]),
  );

  return Promise.all(
    data.map(async (row) => {
      const attachments = await withSignedUrls(parseAttachments(row.attachments));
      const fromClient = row.sender_user_id === requesterId;
      const senderId = row.sender_user_id as string | null;
      return {
        id: row.id as string,
        role: fromClient ? "bot" : "user",
        text: row.body as string,
        timestamp: new Date(row.created_at as string).toLocaleTimeString("es", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        attachments,
        senderKind: fromClient ? "client" : "agent",
        senderName: fromClient
          ? "Cliente"
          : senderId
            ? (profileMap.get(senderId) ?? "Agente")
            : "Soporte",
      } satisfies ChatMessage;
    }),
  );
}

export async function claimInboxTicket(input: {
  session: SessionUser;
  ticketId: string;
}): Promise<InboxTicketItem | null> {
  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .select("id, assigned_user_id, status")
    .eq("id", input.ticketId)
    .maybeSingle<{ id: string; assigned_user_id: string | null; status: string }>();

  if (error || !ticket) {
    throw new Error(error?.message ?? "Ticket no encontrado.");
  }

  if (
    ticket.assigned_user_id &&
    ticket.assigned_user_id !== input.session.id
  ) {
    throw new Error("Otro agente ya tomó este chat.");
  }

  const { error: updateError } = await admin
    .from("support_tickets")
    .update({
      assigned_user_id: input.session.id,
      status: ticket.status === "closed" || ticket.status === "resolved" ? ticket.status : "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticketId);

  if (updateError) {
    // Si pending falla por enum raro, al menos asignar.
    const { error: fallbackError } = await admin
      .from("support_tickets")
      .update({
        assigned_user_id: input.session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.ticketId);
    if (fallbackError) throw new Error(fallbackError.message);
  }

  const items = await listInboxTickets({ status: "all" });
  return items.find((item) => item.id === input.ticketId) ?? null;
}

export async function releaseInboxTicket(input: {
  session: SessionUser;
  ticketId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .select("id, assigned_user_id")
    .eq("id", input.ticketId)
    .maybeSingle<{ id: string; assigned_user_id: string | null }>();

  if (error || !ticket) {
    throw new Error(error?.message ?? "Ticket no encontrado.");
  }
  if (ticket.assigned_user_id && ticket.assigned_user_id !== input.session.id) {
    throw new Error("Solo el agente asignado puede liberar el chat.");
  }

  const { error: updateError } = await admin
    .from("support_tickets")
    .update({
      assigned_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.ticketId);

  if (updateError) throw new Error(updateError.message);
}

export async function replyInboxTicket(input: {
  session: SessionUser;
  ticketId: string;
  message: string;
  files?: File[];
  status?: string;
}): Promise<ChatMessage> {
  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .select("id, organization_id, requester_user_id, subject, status, assigned_user_id")
    .eq("id", input.ticketId)
    .maybeSingle<{
      id: string;
      organization_id: string | null;
      requester_user_id: string | null;
      subject: string;
      status: string;
      assigned_user_id: string | null;
    }>();

  if (error || !ticket) {
    throw new Error(error?.message ?? "Ticket no encontrado.");
  }

  if (
    ticket.assigned_user_id &&
    ticket.assigned_user_id !== input.session.id
  ) {
    throw new Error("Este chat lo está atendiendo otro agente. Pedile que lo libere o tomalo solo si está libre.");
  }

  // Whaticket-style: al responder se toma el chat automáticamente.
  if (!ticket.assigned_user_id) {
    await admin
      .from("support_tickets")
      .update({
        assigned_user_id: input.session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);
  }

  const files = input.files ?? [];
  const attachments: SupportAttachmentInput[] = [];
  for (const file of files) {
    attachments.push(await uploadInboxAttachment(ticket.id, file));
  }

  const body = input.message.trim() || (attachments.length ? "📎 Adjunto" : "");
  if (!body) throw new Error("Mensaje o adjunto requerido.");

  const { data: message, error: insertError } = await admin
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      organization_id: ticket.organization_id,
      sender_user_id: input.session.id,
      body,
      internal_note: false,
      attachments: attachments.map((item) => ({
        name: item.name,
        mime_type: item.mimeType,
        path: item.path,
        bucket: item.bucket,
        size: item.size,
      })),
    })
    .select("id, body, sender_user_id, internal_note, created_at, attachments")
    .single();

  if (insertError || !message) {
    throw new Error(insertError?.message ?? "No se pudo responder.");
  }

  const nextStatus =
    input.status && ["open", "pending", "resolved", "closed"].includes(input.status)
      ? input.status
      : "pending";

  await updateTicketStatusWithFallback({
    ticketId: ticket.id,
    status: nextStatus,
    assignedUserId: input.session.id,
  });

  await createNotificationBestEffort({
    organizationId: ticket.organization_id,
    userId: ticket.requester_user_id,
    title: "Soporte respondió tu ticket",
    body: ticket.subject,
    type: "support_reply",
    data: { ticket_id: ticket.id, url: "/support" },
  });

  const signed = await withSignedUrls(parseAttachments(message.attachments));
  const agentLabel =
    input.session.email?.split("@")[0] ||
    "Agente";
  return {
    id: message.id as string,
    role: "user",
    text: message.body as string,
    timestamp: new Date(message.created_at as string).toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    attachments: signed,
    senderKind: "agent",
    senderName: agentLabel,
  };
}

export async function updateInboxTicketStatus(input: {
  session: SessionUser;
  ticketId: string;
  status: string;
}): Promise<void> {
  if (!["open", "pending", "resolved", "closed"].includes(input.status)) {
    throw new Error("Estado inválido.");
  }
  await updateTicketStatusWithFallback({
    ticketId: input.ticketId,
    status: input.status,
    assignedUserId: input.session.id,
  });
}

async function updateTicketStatusWithFallback(input: {
  ticketId: string;
  status: string;
  assignedUserId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const desired = input.status;
  const closedAt =
    desired === "closed" || desired === "resolved"
      ? new Date().toISOString()
      : null;

  const run = async (status: string) =>
    admin
      .from("support_tickets")
      .update({
        status,
        assigned_user_id: input.assignedUserId,
        updated_at: new Date().toISOString(),
        closed_at: status === "closed" || status === "resolved" ? closedAt : null,
      })
      .eq("id", input.ticketId);

  let { error } = await run(desired);
  if (error && desired === "resolved") {
    // Prod a veces no tiene el valor `resolved` en el enum.
    ({ error } = await run("closed"));
  }
  if (error) throw new Error(error.message);
}
