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
import {
  getHecomCliente,
  listHecomClientes,
  type HecomCliente,
} from "@/lib/hecom/clientes.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { supportChatTimestamps } from "@/lib/support/chat-time";

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
  /** Nombre visible estilo WhatsApp (nunca el correo como título). */
  requesterDisplayName: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  assignedUserDisplayName: string | null;
  /** true si aún no hay ticket de soporte (solo contacto CRM). */
  hasTicket?: boolean;
  /** Cliente Hecom Club (fuente de la lista del gerente). */
  hecomClienteId?: string | null;
  /** Tiene usuario/org en Ads Holistic para recibir Soporte. */
  hasHolisticAccount?: boolean;
  /** Foto de perfil Hecom (avatar_url). */
  avatarUrl?: string | null;
  /** Vista previa del último mensaje público del ticket. */
  lastMessagePreview?: string | null;
  /** Fecha del último mensaje (para ordenar / lista lateral). */
  lastMessageAt?: string | null;
  /** true si el último mensaje público lo escribió el cliente (no el staff). */
  lastMessageFromClient?: boolean;
  /** requester_user_id del ticket (cliente). */
  requesterUserId?: string | null;
}

/** Etiqueta de persona: nombre real → org → local-part del mail (nunca el email completo). */
export function personDisplayName(
  name?: string | null,
  email?: string | null,
  fallback = "Cliente",
  orgName?: string | null,
): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const org = orgName?.trim();
  if (org) return org;
  const local = email?.split("@")[0]?.replace(/[._+-]+/g, " ").trim();
  if (local) {
    return local.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return fallback;
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

function summarizeMessagePreview(body: string, attachmentsRaw: unknown): string {
  const text = (body ?? "").trim().replace(/\s+/g, " ");
  if (text) {
    return text.length > 72 ? `${text.slice(0, 69)}…` : text;
  }
  const atts = parseAttachments(attachmentsRaw);
  if (atts.length === 0) return "";
  return atts.some((a) => a.mimeType.startsWith("image/")) ? "📷 Foto" : "📎 Adjunto";
}

async function attachLastMessagePreviews(
  items: InboxTicketItem[],
): Promise<InboxTicketItem[]> {
  const ticketIds = items
    .filter(
      (item) =>
        item.hasTicket !== false &&
        !item.id.startsWith("org:") &&
        !item.id.startsWith("hecom:"),
    )
    .map((item) => item.id);
  if (ticketIds.length === 0) return items;

  const admin = createAdminClient();
  const [{ data }, { data: ticketRows }] = await Promise.all([
    admin
      .from("support_messages")
      .select("ticket_id, body, created_at, attachments, sender_user_id")
      .in("ticket_id", ticketIds)
      .eq("internal_note", false)
      .order("created_at", { ascending: false })
      .limit(Math.min(ticketIds.length * 25, 800)),
    admin
      .from("support_tickets")
      .select("id, requester_user_id")
      .in("id", ticketIds),
  ]);

  const requesterByTicket = new Map<string, string | null>();
  for (const row of ticketRows ?? []) {
    requesterByTicket.set(
      row.id as string,
      (row.requester_user_id as string | null) ?? null,
    );
  }

  const previewByTicket = new Map<
    string,
    { preview: string; at: string; fromClient: boolean; senderUserId: string | null }
  >();
  for (const row of data ?? []) {
    const ticketId = row.ticket_id as string;
    if (previewByTicket.has(ticketId)) continue;
    const senderId = (row.sender_user_id as string | null) ?? null;
    const requesterId = requesterByTicket.get(ticketId) ?? null;
    const fromClient = Boolean(
      senderId && requesterId && senderId === requesterId,
    );
    previewByTicket.set(ticketId, {
      preview: summarizeMessagePreview(
        row.body as string,
        row.attachments,
      ),
      at: row.created_at as string,
      fromClient,
      senderUserId: senderId,
    });
  }

  return items.map((item) => {
    const latest = previewByTicket.get(item.id);
    if (!latest) return item;
    return {
      ...item,
      lastMessagePreview: latest.preview || item.subject,
      lastMessageAt: latest.at,
      lastMessageFromClient: latest.fromClient,
      requesterUserId:
        item.requesterUserId ?? requesterByTicket.get(item.id) ?? null,
    };
  });
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
    const organizationName = row.organization_id
      ? (orgMap.get(row.organization_id as string) ?? null)
      : null;
    const requesterName = requester?.name ?? null;
    const requesterEmail = requester?.email ?? null;
    const assignedUserName = assignee?.name ?? null;
    const assignedUserEmail = assignee?.email ?? null;
    return {
      id: row.id as string,
      subject: row.subject as string,
      status: row.status as string,
      priority: (row.priority as string) ?? "normal",
      category: (row.category as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: (row.updated_at as string | null) ?? null,
      organizationId: (row.organization_id as string | null) ?? null,
      organizationName,
      requesterUserId: (row.requester_user_id as string | null) ?? null,
      requesterEmail,
      requesterName,
      requesterDisplayName: personDisplayName(
        requesterName,
        requesterEmail,
        "Cliente",
        organizationName,
      ),
      assignedUserId: (row.assigned_user_id as string | null) ?? null,
      assignedUserName,
      assignedUserEmail,
      assignedUserDisplayName: row.assigned_user_id
        ? personDisplayName(assignedUserName, assignedUserEmail, "Agente")
        : null,
    };
  });

  items = await attachLastMessagePreviews(items);

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    items = items.filter((item) =>
      [
        item.requesterDisplayName,
        item.requesterName,
        item.organizationName,
        item.subject,
        item.lastMessagePreview,
        item.requesterEmail,
        item.assignedUserDisplayName,
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

/**
 * Lista clientes de Hecom Club (no gerentes) + último ticket Holistic si existe.
 * Al responder, el mensaje llega al Soporte de la cuenta Holistic del cliente.
 */
export async function listInboxContacts(filters?: {
  status?: string;
  q?: string;
  assignedUserId?: string;
}): Promise<InboxTicketItem[]> {
  const admin = createAdminClient();

  let hecomClientes: HecomCliente[] = [];
  try {
    const listed = await listHecomClientes();
    hecomClientes = listed.clientes;
  } catch (error) {
    console.error("[support-inbox] hecom list", error);
    return [];
  }

  // Sacar gerentes / staff: la lista es solo clientes CRM.
  hecomClientes = hecomClientes.filter(
    (cliente) => !cliente.emails.some((email) => isHecomOtpStaffEmail(email)),
  );

  if (hecomClientes.length === 0) return [];

  const hecomIds = hecomClientes.map((c) => c.id);
  const allEmails = [
    ...new Set(
      hecomClientes.flatMap((c) =>
        c.emails.map((e) => e.trim().toLowerCase()).filter(Boolean),
      ),
    ),
  ];

  const { data: links } = await admin
    .from("hecom_cliente_user_links")
    .select("hecom_cliente_id, user_id, email")
    .in("hecom_cliente_id", hecomIds);

  const linkUserIds = [
    ...new Set((links ?? []).map((l) => l.user_id as string).filter(Boolean)),
  ];

  // Perfiles por email del CRM (cuenta Holistic del cliente).
  const emailProfiles: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
  }> = [];
  const chunkSize = 80;
  for (let i = 0; i < allEmails.length; i += chunkSize) {
    const chunk = allEmails.slice(i, i + chunkSize);
    const { data } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("email", chunk);
    if (data) emailProfiles.push(...data);
  }

  const profileByEmail = new Map(
    emailProfiles
      .filter((p) => p.email)
      .map((p) => [String(p.email).trim().toLowerCase(), p]),
  );

  const userIds = [
    ...new Set([
      ...linkUserIds,
      ...emailProfiles.map((p) => p.id),
    ]),
  ];

  const [{ data: memberships }, { data: profileRows }] = await Promise.all([
    userIds.length
      ? admin
          .from("organization_memberships")
          .select("organization_id, user_id, role, status")
          .in("user_id", userIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] as Array<{
          organization_id: string;
          user_id: string;
          role: string;
          status: string;
        }> }),
    userIds.length
      ? admin.from("profiles").select("id, email, full_name").in("id", userIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            email: string | null;
            full_name: string | null;
          }>,
        }),
  ]);

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [
      p.id,
      { email: p.email, name: p.full_name },
    ]),
  );

  const membershipByUser = new Map<
    string,
    { organization_id: string; role: string }
  >();
  for (const m of memberships ?? []) {
    const uid = m.user_id as string;
    const prev = membershipByUser.get(uid);
    const score = (role: string) =>
      role === "owner" ? 0 : role === "admin" ? 1 : 2;
    if (!prev || score(m.role as string) < score(prev.role)) {
      membershipByUser.set(uid, {
        organization_id: m.organization_id as string,
        role: m.role as string,
      });
    }
  }

  const linksByCliente = new Map<string, string[]>();
  for (const link of links ?? []) {
    const cid = link.hecom_cliente_id as string;
    const uid = link.user_id as string;
    const list = linksByCliente.get(cid) ?? [];
    list.push(uid);
    linksByCliente.set(cid, list);
  }

  type Binding = {
    organizationId: string | null;
    requesterUserId: string | null;
    requesterEmail: string | null;
    requesterName: string | null;
  };

  function bindCliente(cliente: HecomCliente): Binding {
    const linkedUsers = linksByCliente.get(cliente.id) ?? [];
    for (const uid of linkedUsers) {
      const mem = membershipByUser.get(uid);
      if (mem) {
        const profile = profileMap.get(uid);
        return {
          organizationId: mem.organization_id,
          requesterUserId: uid,
          requesterEmail: profile?.email ?? cliente.emails[0] ?? null,
          requesterName: profile?.name ?? cliente.name,
        };
      }
    }
    for (const email of cliente.emails) {
      const profile = profileByEmail.get(email.trim().toLowerCase());
      if (!profile) continue;
      const mem = membershipByUser.get(profile.id);
      if (!mem) continue;
      return {
        organizationId: mem.organization_id,
        requesterUserId: profile.id,
        requesterEmail: profile.email,
        requesterName: profile.full_name ?? cliente.name,
      };
    }
    return {
      organizationId: null,
      requesterUserId: null,
      requesterEmail: cliente.emails[0] ?? null,
      requesterName: cliente.name,
    };
  }

  const bindings = new Map(
    hecomClientes.map((c) => [c.id, bindCliente(c)] as const),
  );

  const orgIds = [
    ...new Set(
      [...bindings.values()]
        .map((b) => b.organizationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: orgs }, { data: tickets }] = await Promise.all([
    orgIds.length
      ? admin.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    orgIds.length
      ? admin
          .from("support_tickets")
          .select(
            "id, organization_id, requester_user_id, assigned_user_id, subject, status, priority, category, created_at, updated_at, metadata",
          )
          .in("organization_id", orgIds)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(800)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const orgNameMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const assigneeIds = [
    ...new Set(
      (tickets ?? [])
        .map((t) => t.assigned_user_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: assigneeProfiles } = assigneeIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", assigneeIds)
    : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> };
  for (const p of assigneeProfiles ?? []) {
    profileMap.set(p.id, { email: p.email, name: p.full_name });
  }

  type TicketRow = {
    id: string;
    organization_id: string | null;
    requester_user_id: string | null;
    assigned_user_id: string | null;
    subject: string;
    status: string;
    priority: string | null;
    category: string | null;
    created_at: string;
    updated_at: string | null;
    metadata: unknown;
  };

  const ticketRows = (tickets ?? []) as TicketRow[];

  // Ticket más reciente por hecom_cliente_id (metadata) o por organization_id.
  const latestByHecom = new Map<string, TicketRow>();
  const latestByOrg = new Map<string, TicketRow>();
  for (const t of ticketRows) {
    const meta = (t.metadata ?? {}) as Record<string, unknown>;
    const hecomId =
      typeof meta.hecom_cliente_id === "string" ? meta.hecom_cliente_id : null;
    if (hecomId && !latestByHecom.has(hecomId)) {
      latestByHecom.set(hecomId, t);
    }
    const orgId = t.organization_id;
    if (orgId && !latestByOrg.has(orgId)) {
      latestByOrg.set(orgId, t);
    }
  }

  let items: InboxTicketItem[] = hecomClientes.map((cliente) => {
    const binding = bindings.get(cliente.id)!;
    const ticket =
      latestByHecom.get(cliente.id) ??
      (binding.organizationId
        ? latestByOrg.get(binding.organizationId)
        : undefined);
    const assignee = ticket?.assigned_user_id
      ? profileMap.get(ticket.assigned_user_id as string)
      : undefined;
    const organizationName = binding.organizationId
      ? (orgNameMap.get(binding.organizationId) ?? null)
      : null;
    const displayName = (cliente.name || "").trim() || "Cliente";
    const hasHolisticAccount = Boolean(binding.organizationId);

    return {
      id: ticket
        ? (ticket.id as string)
        : `hecom:${cliente.id}`,
      subject: ticket
        ? (ticket.subject as string)
        : hasHolisticAccount
          ? "Sin conversación todavía"
          : "Sin cuenta Holistic aún",
      status: ticket ? (ticket.status as string) : "none",
      priority: ticket ? ((ticket.priority as string) ?? "normal") : "normal",
      category: ticket ? ((ticket.category as string | null) ?? null) : null,
      createdAt: ticket
        ? (ticket.created_at as string)
        : (cliente.createdAt ?? new Date().toISOString()),
      updatedAt: ticket
        ? ((ticket.updated_at as string | null) ?? null)
        : (cliente.createdAt ?? null),
      organizationId: binding.organizationId,
      organizationName,
      requesterEmail: binding.requesterEmail,
      requesterName: displayName,
      requesterDisplayName: displayName,
      assignedUserId: ticket
        ? ((ticket.assigned_user_id as string | null) ?? null)
        : null,
      assignedUserName: assignee?.name ?? null,
      assignedUserEmail: assignee?.email ?? null,
      assignedUserDisplayName: ticket?.assigned_user_id
        ? personDisplayName(assignee?.name, assignee?.email, "Agente")
        : null,
      hasTicket: Boolean(ticket),
      hecomClienteId: cliente.id,
      hasHolisticAccount,
      avatarUrl: cliente.avatarUrl ?? null,
    };
  });

  const status = filters?.status ?? "all";
  if (status && status !== "all") {
    if (status === "active") {
      items = items.filter(
        (item) => item.hasTicket && ["open", "pending"].includes(item.status),
      );
    } else if (status === "unassigned") {
      items = items.filter(
        (item) =>
          item.hasTicket &&
          ["open", "pending"].includes(item.status) &&
          !item.assignedUserId,
      );
    } else if (status === "mine" && filters?.assignedUserId) {
      items = items.filter(
        (item) =>
          item.hasTicket &&
          ["open", "pending"].includes(item.status) &&
          item.assignedUserId === filters.assignedUserId,
      );
    } else if (status === "pending") {
      items = items.filter((item) => item.hasTicket && item.status === "pending");
    } else if (status === "resolved" || status === "closed") {
      items = items.filter((item) => item.hasTicket && item.status === status);
    }
  }

  items = await attachLastMessagePreviews(items);

  items.sort((a, b) => {
    const aActive =
      a.hasTicket && ["open", "pending"].includes(a.status) ? 0 : 1;
    const bActive =
      b.hasTicket && ["open", "pending"].includes(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    if (aActive === 0) {
      const aTime = new Date(
        a.lastMessageAt ?? a.updatedAt ?? a.createdAt,
      ).getTime();
      const bTime = new Date(
        b.lastMessageAt ?? b.updatedAt ?? b.createdAt,
      ).getTime();
      return bTime - aTime;
    }
    return a.requesterDisplayName.localeCompare(b.requesterDisplayName, "es");
  });

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    items = items.filter((item) =>
      [
        item.requesterDisplayName,
        item.requesterName,
        item.organizationName,
        item.subject,
        item.lastMessagePreview,
        item.requesterEmail,
        item.hecomClienteId,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }

  return items;
}

/** Abre / reutiliza ticket Holistic para un cliente Hecom (mensaje llega a su Soporte). */
export async function ensureInboxTicketForHecomCliente(input: {
  session: SessionUser;
  hecomClienteId: string;
}): Promise<InboxTicketItem> {
  const admin = createAdminClient();
  const cliente = await getHecomCliente(input.hecomClienteId);
  if (!cliente) {
    throw new Error("Cliente Hecom no encontrado.");
  }
  if (cliente.emails.some((email) => isHecomOtpStaffEmail(email))) {
    throw new Error("Ese contacto es gerente/staff, no un cliente.");
  }

  const contacts = await listInboxContacts({ status: "all" });
  const existingContact = contacts.find(
    (c) => c.hecomClienteId === cliente.id && c.hasTicket,
  );
  if (existingContact && !existingContact.id.startsWith("hecom:")) {
    return existingContact;
  }

  const bindingContact = contacts.find((c) => c.hecomClienteId === cliente.id);
  if (!bindingContact?.organizationId || !bindingContact.hasHolisticAccount) {
    throw new Error(
      "Este cliente aún no tiene cuenta en Ads Holistic. Cuando entre con su correo, verá Soporte Holistic.",
    );
  }

  const organizationId = bindingContact.organizationId;

  const { data: openRows } = await admin
    .from("support_tickets")
    .select("id")
    .eq("organization_id", organizationId)
    .in("status", ["open", "pending"])
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(5);

  for (const row of openRows ?? []) {
    const found = contacts.find((c) => c.id === row.id);
    if (found) return found;
  }

  let requesterId: string | null = null;
  const { data: links } = await admin
    .from("hecom_cliente_user_links")
    .select("user_id")
    .eq("hecom_cliente_id", cliente.id)
    .limit(5);
  if (links?.[0]?.user_id) {
    requesterId = links[0].user_id as string;
  } else {
    for (const email of cliente.emails) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle<{ id: string }>();
      if (profile?.id) {
        requesterId = profile.id;
        break;
      }
    }
  }
  if (!requesterId) {
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(20);
    const sorted = (membership ?? []).slice().sort((a, b) => {
      const score = (role: string) =>
        role === "owner" ? 0 : role === "admin" ? 1 : 2;
      return score(a.role as string) - score(b.role as string);
    });
    requesterId = (sorted[0]?.user_id as string | undefined) ?? null;
  }

  const now = new Date().toISOString();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({
      organization_id: organizationId,
      requester_user_id: requesterId,
      assigned_user_id: input.session.id,
      subject: `Soporte · ${cliente.name}`,
      status: "open",
      priority: "normal",
      category: "chat",
      metadata: {
        source: "gerente_inbox",
        hecom_cliente_id: cliente.id,
        hecom_cliente_name: cliente.name,
      },
      updated_at: now,
    })
    .select(
      "id, organization_id, requester_user_id, assigned_user_id, subject, status, priority, category, created_at, updated_at",
    )
    .single();

  if (error || !ticket) {
    throw new Error(error?.message ?? "No se pudo abrir el chat del cliente.");
  }

  await createNotificationBestEffort({
    organizationId,
    userId: requesterId,
    title: "Soporte Holistic te escribió",
    body: `Tenés un mensaje nuevo de soporte.`,
    type: "support_reply",
    data: { ticket_id: ticket.id, url: "/support", hecom_cliente_id: cliente.id },
  });

  return {
    id: ticket.id as string,
    subject: ticket.subject as string,
    status: ticket.status as string,
    priority: (ticket.priority as string) ?? "normal",
    category: (ticket.category as string | null) ?? null,
    createdAt: ticket.created_at as string,
    updatedAt: (ticket.updated_at as string | null) ?? null,
    organizationId,
    organizationName: bindingContact.organizationName,
    requesterEmail: bindingContact.requesterEmail,
    requesterName: cliente.name,
    requesterDisplayName: cliente.name,
    assignedUserId: input.session.id,
    assignedUserName: null,
    assignedUserEmail: input.session.email,
    assignedUserDisplayName: personDisplayName(
      null,
      input.session.email,
      "Agente",
    ),
    hasTicket: true,
    hecomClienteId: cliente.id,
    hasHolisticAccount: true,
    avatarUrl: cliente.avatarUrl ?? null,
  };
}

/** @deprecated Prefer ensureInboxTicketForHecomCliente */
export async function ensureInboxTicketForOrganization(input: {
  session: SessionUser;
  organizationId: string;
}): Promise<InboxTicketItem> {
  const admin = createAdminClient();
  const organizationId = input.organizationId;

  const { data: existingRows } = await admin
    .from("support_tickets")
    .select("id")
    .eq("organization_id", organizationId)
    .in("status", ["open", "pending"])
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);

  const existingId = existingRows?.[0]?.id as string | undefined;
  if (existingId) {
    const contacts = await listInboxContacts({ status: "all" });
    const found = contacts.find((c) => c.id === existingId);
    if (found) return found;
  }

  throw new Error(
    "Usá un cliente de Hecom Club. Este inbox ya no abre chats por organización interna.",
  );
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
        ...supportChatTimestamps(row.created_at as string),
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
      personDisplayName(p.full_name, p.email, "Agente"),
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
        ...supportChatTimestamps(row.created_at as string),
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
    ...supportChatTimestamps(message.created_at as string),
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
