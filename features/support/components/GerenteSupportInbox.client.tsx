"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/features/support/types/support.types";
import { ChatConversation } from "@/features/support/components/ChatConversation";
import { StaffMeetingsBoard } from "@/features/support/components/StaffMeetingsBoard.client";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import {
  useSupportListPolling,
  useSupportThreadPolling,
} from "@/features/support/hooks/useSupportPolling";
import {
  formatInboxListTime,
  supportChatTimestampsNow,
} from "@/lib/support/chat-time";
import { playSupportNotifySound } from "@/lib/support/notify-sound.client";

interface InboxTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  updatedAt: string | null;
  organizationId?: string | null;
  organizationName: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
  requesterDisplayName: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  assignedUserDisplayName: string | null;
  hasTicket?: boolean;
  hecomClienteId?: string | null;
  hasHolisticAccount?: boolean;
  avatarUrl?: string | null;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  lastMessageFromClient?: boolean;
  lastMessageSenderUserId?: string | null;
  requesterUserId?: string | null;
  staffReadAt?: string | null;
  unreadForStaff?: boolean;
}

function clientLabel(ticket: InboxTicket) {
  return (
    ticket.requesterDisplayName ||
    ticket.requesterName ||
    ticket.organizationName ||
    "Cliente"
  );
}

function emptyThread(): ChatMessage[] {
  return [
    {
      id: "inbox-empty",
      role: "bot",
      text: "Elige un cliente a la izquierda para atender.",
      ...supportChatTimestampsNow(),
      senderName: "Sistema",
      senderKind: "system",
    },
  ];
}

const FILTERS = [
  { id: "chats", label: "Chats" },
  { id: "all", label: "Contactos" },
] as const;

export function GerenteSupportInbox() {
  const [tickets, setTickets] = useState<InboxTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // "all" = lista completa Hecom Club (default). "unassigned" oculta clientes sin ticket abierto.
  const [statusFilter, setStatusFilter] = useState("chats");
  const [q, setQ] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(emptyThread());
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [workspace, setWorkspace] = useState<"chats" | "meetings">("chats");
  const [pendingMeetings, setPendingMeetings] = useState(0);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set());
  const knownUpdatedAtRef = useRef<Map<string, string>>(new Map());
  const selectedMetaRef = useRef<{
    id: string;
    hecomClienteId?: string | null;
  } | null>(null);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;
  const hasRealTicket = Boolean(
    selected?.hasTicket !== false &&
      selected &&
      !selected.id.startsWith("org:") &&
      !selected.id.startsWith("hecom:"),
  );
  const selectedClientName = selected ? clientLabel(selected) : null;

  useEffect(() => {
    selectedMetaRef.current = selected
      ? { id: selected.id, hecomClienteId: selected.hecomClienteId }
      : null;
  }, [selected]);

  useEffect(() => {
  const n = unreadIds.size;
    const base = "Chats";
    document.title = n > 0 ? `(${n}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unreadIds]);

  useEffect(() => {
    let cancelled = false;
    let known: number | null = null;
    async function tick() {
      try {
        const res = await fetch("/api/support/meetings?scope=counts", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json()) as { counts?: { pending?: number } };
        const pending = data.counts?.pending ?? 0;
        if (cancelled) return;
        if (known !== null && pending > known) playSupportNotifySound();
        known = pending;
        setPendingMeetings(pending);
      } catch {
        if (!cancelled && known === null) setPendingMeetings(0);
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [workspace]);

  const filteredTickets = tickets.filter((ticket) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return [
      ticket.requesterDisplayName,
      ticket.requesterName,
      ticket.organizationName,
      ticket.subject,
      ticket.lastMessagePreview,
      ticket.requesterEmail,
      ticket.assignedUserDisplayName,
      ticket.assignedUserName,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const loadTickets = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams({ status: statusFilter });
      const res = await fetch(`/api/support/inbox?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        tickets?: InboxTicket[];
        me?: { id: string; email: string };
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo cargar el inbox.");
      }
      const nextTickets = data.tickets ?? [];
      setTickets(nextTickets);

      const meta = selectedMetaRef.current;
      const selectedNow = meta?.id ?? null;

      // Leído es del equipo: solo queda pendiente si el cliente escribió
      // después de que algún gerente abrió el chat.
      setUnreadIds((prev) => {
        const next = new Set<string>();
        for (const ticket of nextTickets) {
          if (ticket.unreadForStaff && ticket.id !== selectedNow) {
            next.add(ticket.id);
          }
          const stamp =
            ticket.lastMessageAt ?? ticket.updatedAt ?? ticket.createdAt;
          knownUpdatedAtRef.current.set(ticket.id, stamp);
        }
        if (opts?.silent) {
          let added = false;
          for (const id of next) {
            if (!prev.has(id)) added = true;
          }
          if (added) playSupportNotifySound();
        }
        return next;
      });

      // Si estaba en contacto Hecom sin ticket y el cliente escribió → abrir hilo real.
      if (
        meta &&
        (meta.id.startsWith("hecom:") || meta.id.startsWith("org:")) &&
        meta.hecomClienteId
      ) {
        const real = nextTickets.find(
          (t) =>
            t.hecomClienteId === meta.hecomClienteId &&
            t.hasTicket !== false &&
            !t.id.startsWith("hecom:") &&
            !t.id.startsWith("org:"),
        );
        if (real) {
          setSelectedId(real.id);
          setUnreadIds((prev) => {
            const next = new Set(prev);
            next.delete(real.id);
            return next;
          });
          knownUpdatedAtRef.current.set(
            real.id,
            real.updatedAt ?? real.createdAt,
          );
          try {
            const msgRes = await fetch(
              `/api/support/inbox/${real.id}/messages`,
              { credentials: "include", cache: "no-store" },
            );
            const msgData = (await msgRes.json()) as {
              ok?: boolean;
              messages?: ChatMessage[];
            };
            if (msgRes.ok && msgData.ok && msgData.messages?.length) {
              setMessages(msgData.messages);
            }
          } catch {
            // el poll del hilo reintenta
          }
        }
      }
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : "Error al cargar inbox.");
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const refreshTicketsSilent = useCallback(async () => {
    await loadTickets({ silent: true });
  }, [loadTickets]);

  useSupportListPolling({
    enabled: true,
    intervalMs: 3000,
    refresh: refreshTicketsSilent,
  });

  const fetchLiveMessages = useCallback(async (): Promise<ChatMessage[] | null> => {
    if (
      !selectedId ||
      selectedId.startsWith("org:") ||
      selectedId.startsWith("hecom:")
    ) {
      return null;
    }
    const res = await fetch(`/api/support/inbox/${selectedId}/messages`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ok?: boolean;
      messages?: ChatMessage[];
    };
    if (!res.ok || !data.ok) return null;
    return data.messages ?? [];
  }, [selectedId]);

  useSupportThreadPolling({
    enabled:
      Boolean(selectedId) &&
      !selectedId?.startsWith("org:") &&
      !selectedId?.startsWith("hecom:") &&
      !sending &&
      !clearingChat &&
      !loadingThread,
    intervalMs: 2000,
    fetchMessages: fetchLiveMessages,
    onMessages: setMessages,
  });

  async function handleClearChat() {
    if (
      !selectedId ||
      selectedId.startsWith("org:") ||
      selectedId.startsWith("hecom:") ||
      clearingChat
    ) {
      return;
    }
    setClearingChat(true);
    setThreadError(null);
    try {
      const res = await fetch(`/api/support/inbox/${selectedId}/messages`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo borrar el chat.");
      }
      setMessages([
        {
          id: "empty",
          role: "bot",
          text: "Chat borrado. Escribe para empezar de nuevo.",
          ...supportChatTimestampsNow(),
          senderName: "Sistema",
          senderKind: "system",
        },
      ]);
      await loadTickets({ silent: true });
    } catch (err) {
      setThreadError(
        err instanceof Error ? err.message : "No se pudo borrar el chat.",
      );
    } finally {
      setClearingChat(false);
    }
  }

  async function ensureTicketId(contact: InboxTicket): Promise<string> {
    if (
      contact.hasTicket !== false &&
      !contact.id.startsWith("org:") &&
      !contact.id.startsWith("hecom:")
    ) {
      return contact.id;
    }
    if (!contact.hecomClienteId) {
      throw new Error("Cliente Hecom no identificado.");
    }
    if (contact.hasHolisticAccount === false) {
      throw new Error(
        "Este cliente aún no tiene cuenta en Ads Holistic. Cuando entre con su correo verá Soporte Holistic.",
      );
    }
    const res = await fetch("/api/support/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "ensure",
        hecomClienteId: contact.hecomClienteId,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      ticket?: InboxTicket;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.ticket) {
      throw new Error(data.error ?? "No se pudo abrir el chat.");
    }
    setTickets((prev) => {
      const withoutSynthetic = prev.filter(
        (t) => t.id !== contact.id && t.id !== data.ticket!.id,
      );
      return [data.ticket!, ...withoutSynthetic];
    });
    setSelectedId(data.ticket.id);
    return data.ticket.id;
  }

  async function openTicket(id: string) {
    setSelectedId(id);
    setMobileShowChat(true);
    setLoadingThread(true);
    setThreadError(null);
    setUnreadIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    if (id.startsWith("org:") || id.startsWith("hecom:")) {
      const contact = tickets.find((t) => t.id === id);
      const noAccount = contact?.hasHolisticAccount === false;
      setMessages([
        {
          id: "no-thread",
          role: "bot",
          text: noAccount
            ? "Este cliente de Hecom aún no tiene cuenta en Ads Holistic. Cuando entre con su correo, verá Soporte Holistic acá."
            : "Todavía no hay mensajes. Escribe para iniciar; le llega a su Soporte Holistic.",
          ...supportChatTimestampsNow(),
          senderName: "Sistema",
          senderKind: "system",
        },
      ]);
      setLoadingThread(false);
      return;
    }

    try {
      const res = await fetch(`/api/support/inbox/${id}/messages`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        messages?: ChatMessage[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo cargar el hilo.");
      }
      setMessages(
        data.messages && data.messages.length > 0
          ? data.messages
          : [
              {
                id: "empty",
                role: "bot",
                text: "Sin mensajes todavía. Escribe para responder.",
                ...supportChatTimestampsNow(),
                senderName: "Sistema",
              },
            ],
      );
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Error al cargar.");
      setMessages(emptyThread());
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleSend(files: File[] = []) {
    if (!selected) return;
    const text = inputValue.trim();
    if ((!text && files.length === 0) || sending) return;

    setSending(true);
    setThreadError(null);
    setInputValue("");

    const optimistic: ChatMessage = {
      id: `agent-${Date.now()}`,
      role: "user",
      text: text || "📎 Adjunto",
      ...supportChatTimestampsNow(),
      senderName: "Tú",
      senderKind: "agent",
    };
    setMessages((prev) => [
      ...prev.filter((m) => m.id !== "inbox-empty" && m.id !== "no-thread"),
      optimistic,
    ]);

    try {
      const ticketId = await ensureTicketId(selected);
      const formData = new FormData();
      if (text) formData.set("message", text);
      for (const file of files) formData.append("files", file);

      const res = await fetch(`/api/support/inbox/${ticketId}/messages`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: ChatMessage;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.message) {
        throw new Error(data.error ?? "No se pudo enviar.");
      }
      setMessages((prev) =>
        prev.map((msg) => (msg.id === optimistic.id ? data.message! : msg)),
      );
      await loadTickets();
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setInputValue(text);
      setThreadError(err instanceof Error ? err.message : "Error al enviar.");
    } finally {
      setSending(false);
    }
  }

  const headerActions = hasRealTicket ? (
    <div className="flex items-center gap-2">
      <details className="relative">
        <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-lg font-bold text-white/80 hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Más acciones">•••</summary>
        <div className="absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 text-[#332820] shadow-xl">
          {hasRealTicket ? (
            <button type="button" disabled={clearingChat} onClick={() => { if (window.confirm("¿Borrar todos los mensajes de esta conversación?")) void handleClearChat(); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50">Borrar conversación</button>
          ) : null}
        </div>
      </details>
    </div>
  ) : null;

  return (
    <>
      {workspace === "meetings" ? (
        <>
          <div className="h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)]" aria-hidden />
          <div className="fixed inset-x-0 top-14 bottom-0 z-[15] overflow-hidden border-t border-[rgb(15_23_42_/_0.08)] bg-[#f6f4f1] sm:top-16 lg:left-[272px]">
            <StaffMeetingsBoard
              onBackToChats={() => setWorkspace("chats")}
              onPending={setPendingMeetings}
            />
          </div>
        </>
      ) : null}
      {workspace === "chats" ? (
      <>
      {/* Reserva altura en el flujo; el panel real va fixed pegado al sidebar. */}
      <div className="h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)]" aria-hidden />
      <div className="fixed inset-x-0 top-14 bottom-0 z-[15] flex flex-col overflow-hidden border-t border-[rgb(15_23_42_/_0.08)] bg-white sm:top-16 lg:left-[272px]">
        <div className="flex min-h-0 flex-1">
          {/* Lista de chats — columna izquierda tipo CRM */}
          <aside
            className={cn(
              "flex w-full shrink-0 flex-col border-r border-[rgb(15_23_42_/_0.08)] bg-[#faf9f7] lg:w-[22rem] xl:w-[24rem]",
              mobileShowChat && "hidden lg:flex",
            )}
          >
          <div className="shrink-0 border-b border-[rgb(15_23_42_/_0.08)] bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
                  Soporte
                </p>
                <h1 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                  Chats
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWorkspace("meetings")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-3 py-1.5 text-[11px] font-bold text-white"
                >
                  Reuniones
                  {pendingMeetings > 0 ? (
                    <span className="rounded-full bg-white/20 px-1.5 py-0.5 tabular-nums">
                      {pendingMeetings}
                    </span>
                  ) : null}
                </button>
                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--auth-text-muted)]">
                  {filteredTickets.length}
                  {unreadIds.size > 0 ? (
                    <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--brand-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {unreadIds.size}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar chat…"
              className="mt-3 h-10 w-full rounded-xl border border-[var(--auth-input-border)] bg-[#f7f5f2] px-3.5 text-[13px] text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] focus:border-[var(--auth-accent)]/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/15"
            />
            <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    statusFilter === item.id
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-[var(--surface-soft)] text-[var(--auth-text-muted)] hover:text-[var(--auth-text)]",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="mx-3 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {error}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-10 text-center text-[13px] text-[var(--auth-text-muted)]">
                Cargando clientes…
              </p>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <span
                  aria-hidden
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-black/5"
                >
                  {q.trim() ? "🔍" : "💬"}
                </span>
                <p className="mt-4 text-[14px] font-bold text-[var(--auth-text)]">
                  {q.trim()
                    ? "Sin resultados"
                    : statusFilter === "chats"
                      ? "Todavía no hay chats"
                      : "No hay contactos"}
                </p>
                <p className="mt-1.5 max-w-[16rem] text-[12px] leading-relaxed text-[var(--auth-text-muted)]">
                  {q.trim()
                    ? "Prueba con otro nombre o con un pedazo del último mensaje."
                    : statusFilter === "chats"
                      ? "Cuando un cliente escriba, el chat aparece acá para cualquier gerente."
                      : "En Contactos puedes abrir un chat nuevo."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[rgb(15_23_42_/_0.06)]">
                {filteredTickets.map((ticket) => {
                  const active = ticket.id === selectedId;
                  const name = clientLabel(ticket);
                  const unread = unreadIds.has(ticket.id);
                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => void openTicket(ticket.id)}
                        className={cn(
                          "relative flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                          active
                            ? "bg-[rgb(255_120_31_/_0.1)]"
                            : unread
                              ? "bg-[rgb(255_120_31_/_0.06)] hover:bg-[rgb(255_120_31_/_0.1)]"
                              : "hover:bg-white",
                        )}
                      >
                        {unread ? (
                          <span
                            className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--brand-primary)] shadow-[0_0_0_3px_rgb(255_120_31_/_0.25)]"
                            aria-label="Nuevo mensaje"
                          />
                        ) : null}
                        <HecomClienteAvatar
                          name={name}
                          avatarUrl={ticket.avatarUrl}
                          size="md"
                          className="h-12 w-12 text-[13px] shadow-sm ring-2 ring-white"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-[14px] text-[var(--auth-text)]",
                                unread ? "font-extrabold" : "font-bold",
                              )}
                            >
                              {name}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-[10px] tabular-nums",
                                unread
                                  ? "font-bold text-[var(--brand-primary)]"
                                  : "text-[var(--auth-text-soft)]",
                              )}
                            >
                              {formatInboxListTime(
                                ticket.lastMessageAt ??
                                  ticket.updatedAt ??
                                  ticket.createdAt,
                              )}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate text-[12px]",
                              unread
                                ? "font-semibold text-[var(--auth-text)]"
                                : "text-[var(--auth-text-muted)]",
                            )}
                          >
                            {ticket.lastMessagePreview?.trim() ||
                              (ticket.hasHolisticAccount === false
                                ? "Sin cuenta Holistic"
                                : "Sin mensajes")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Panel de conversación */}
        <section
          className={cn(
            "min-w-0 flex-1 bg-[#efeae2]",
            !mobileShowChat && "hidden lg:flex lg:flex-col",
            mobileShowChat && "flex flex-col",
          )}
        >
          {!selectedId ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#efeae2] px-8 text-center">
              <p className="text-[17px] font-bold tracking-[-0.02em] text-[#3f3a34]">
                Chats de soporte
              </p>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[#6b645c]">
                Elige un chat. Cualquier gerente puede leer y responder. Si ya
                lo abrieron, queda leído para todos.
              </p>
              {unreadIds.size > 0 ? (
                <p className="mt-4 rounded-full bg-[var(--brand-primary)] px-4 py-1.5 text-[12px] font-bold text-white shadow-sm">
                  {unreadIds.size} sin leer
                </p>
              ) : null}
            </div>
          ) : (
          <ChatConversation
            messages={messages}
            inputValue={inputValue}
            sending={sending}
            loading={loadingThread}
            error={threadError}
            showBack={mobileShowChat}
            className="min-h-0 flex-1"
            title={selectedClientName ?? "Chat"}
            subtitle={
              selected?.hasHolisticAccount === false
                ? "Aún no tiene cuenta para recibir el chat"
                : "Cualquier gerente puede responder"
            }
            avatarUrl={selected?.avatarUrl}
            headerActions={headerActions}
            onInputChange={setInputValue}
            onSend={(files) => void handleSend(files)}
            onBack={() => setMobileShowChat(false)}
            composerDisabled={selected?.hasHolisticAccount === false}
            composerDisabledReason="Este cliente aún no tiene cuenta Holistic para recibir el chat."
            emptyHint="Escribe para responder al cliente. Puedes pegar capturas o adjuntar archivos."
          />
          )}
        </section>
      </div>
      </div>
      </>
      ) : null}
    </>
  );
}
