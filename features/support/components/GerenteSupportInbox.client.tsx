"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { TICKET_STATUS_LABELS } from "@/lib/constants/status";
import type { ChatMessage } from "@/features/support/types/support.types";
import { ChatConversation } from "@/features/support/components/ChatConversation";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import {
  useSupportListPolling,
  useSupportThreadPolling,
} from "@/features/support/hooks/useSupportPolling";

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
}

function formatTicketDate(value: string) {
  try {
    const d = new Date(value);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
  } catch {
    return value;
  }
}

function clientLabel(ticket: InboxTicket) {
  return (
    ticket.requesterDisplayName ||
    ticket.requesterName ||
    ticket.organizationName ||
    "Cliente"
  );
}

function agentLabel(ticket: InboxTicket | null) {
  if (!ticket) return null;
  return ticket.assignedUserDisplayName || ticket.assignedUserName || null;
}

function emptyThread(): ChatMessage[] {
  return [
    {
      id: "inbox-empty",
      role: "bot",
      text: "Elegí un cliente a la izquierda para atender.",
      timestamp: new Date().toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      senderName: "Sistema",
      senderKind: "system",
    },
  ];
}

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "unassigned", label: "Sin atender" },
  { id: "mine", label: "Míos" },
  { id: "active", label: "Activos" },
  { id: "resolved", label: "Resueltos" },
] as const;

export function GerenteSupportInbox() {
  const [tickets, setTickets] = useState<InboxTicket[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // "all" = lista completa Hecom Club (default). "unassigned" oculta clientes sin ticket abierto.
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [claiming, setClaiming] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(emptyThread());
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;
  const hasRealTicket = Boolean(
    selected?.hasTicket !== false &&
      selected &&
      !selected.id.startsWith("org:") &&
      !selected.id.startsWith("hecom:"),
  );
  const iOwnSelected =
    Boolean(selected?.assignedUserId) && selected?.assignedUserId === meId;
  const isUnassigned = Boolean(
    hasRealTicket && selected && !selected.assignedUserId,
  );
  const ownedByOther =
    hasRealTicket &&
    selected?.assignedUserId &&
    selected.assignedUserId !== meId;
  const selectedClientName = selected ? clientLabel(selected) : null;
  const assigneeLabel = agentLabel(selected);

  const filteredTickets = tickets.filter((ticket) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return [
      ticket.requesterDisplayName,
      ticket.requesterName,
      ticket.organizationName,
      ticket.subject,
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
      setTickets(data.tickets ?? []);
      if (data.me?.id) setMeId(data.me.id);
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
    enabled: !sending,
    intervalMs: 8000,
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
    intervalMs: 2500,
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
          text: "Chat borrado. Escribí para empezar de nuevo.",
          timestamp: new Date().toLocaleTimeString("es", {
            hour: "2-digit",
            minute: "2-digit",
          }),
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

    if (id.startsWith("org:") || id.startsWith("hecom:")) {
      const contact = tickets.find((t) => t.id === id);
      const noAccount = contact?.hasHolisticAccount === false;
      setMessages([
        {
          id: "no-thread",
          role: "bot",
          text: noAccount
            ? "Este cliente de Hecom aún no tiene cuenta en Ads Holistic. Cuando entre con su correo, verá Soporte Holistic acá."
            : "Todavía no hay mensajes. Escribí para iniciar; le llega a su Soporte Holistic.",
          timestamp: new Date().toLocaleTimeString("es", {
            hour: "2-digit",
            minute: "2-digit",
          }),
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
                text: "Sin mensajes todavía. Escribí para responder.",
                timestamp: new Date().toLocaleTimeString("es", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
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

  async function claimOrRelease(action: "claim" | "release") {
    if (!selectedId || selectedId.startsWith("org:") || selectedId.startsWith("hecom:"))
      return;
    setClaiming(true);
    setThreadError(null);
    try {
      const res = await fetch(`/api/support/inbox/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo actualizar la asignación.");
      }
      await loadTickets();
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Error de asignación.");
    } finally {
      setClaiming(false);
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
      timestamp: new Date().toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      senderName: "Vos",
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
      formData.set("status", "pending");
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

  async function setStatus(status: string) {
    if (
      !selectedId ||
      selectedId.startsWith("org:") ||
      selectedId.startsWith("hecom:")
    )
      return;
    try {
      const res = await fetch(`/api/support/inbox/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo actualizar.");
      }
      await loadTickets();
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Error de estado.");
    }
  }

  const headerActions = selected ? (
    <div className="flex items-center gap-2">
      {isUnassigned ? (
        <button type="button" disabled={claiming} onClick={() => void claimOrRelease("claim")} className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-[var(--brand-primary-deep)] disabled:opacity-50">
          {claiming ? "Tomando..." : "Tomar chat"}
        </button>
      ) : null}
      {hasRealTicket && selected.status !== "resolved" ? (
        <button type="button" onClick={() => void setStatus("resolved")} className="hidden rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-white/20 sm:inline-flex">
          Resolver
        </button>
      ) : null}
      <details className="relative">
        <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-lg font-bold text-white/80 hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Más acciones">•••</summary>
        <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 text-[#332820] shadow-xl">
          {[{ id: "open", label: "Marcar abierto" }, { id: "pending", label: "Dejar pendiente" }, { id: "closed", label: "Cerrar conversación" }].map((item) => (
            <button key={item.id} type="button" onClick={() => void setStatus(item.id)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[#f7f2ed]">{item.label}</button>
          ))}
          {iOwnSelected ? <button type="button" disabled={claiming} onClick={() => void claimOrRelease("release")} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[#f7f2ed]">Liberar chat</button> : null}
          {hasRealTicket ? <button type="button" disabled={clearingChat} onClick={() => { if (window.confirm("¿Borrar todos los mensajes de esta conversación?")) void handleClearChat(); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50">Borrar conversación</button> : null}
        </div>
      </details>
    </div>
  ) : null;

  return (
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
                  Inbox
                </p>
                <h1 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                  Soporte · Hecom
                </h1>
              </div>
              <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--auth-text-muted)]">
                {filteredTickets.length}
              </span>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente…"
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
              <p className="px-4 py-10 text-center text-[13px] text-[var(--auth-text-muted)]">
                {statusFilter === "all"
                  ? "No hay clientes Hecom para mostrar."
                  : "No hay clientes en este filtro. Probá “Todos”."}
              </p>
            ) : (
              <ul className="divide-y divide-[rgb(15_23_42_/_0.06)]">
                {filteredTickets.map((ticket) => {
                  const active = ticket.id === selectedId;
                  const mine = ticket.assignedUserId === meId;
                  const free = !ticket.assignedUserId && Boolean(ticket.hasTicket);
                  const name = clientLabel(ticket);
                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        onClick={() => void openTicket(ticket.id)}
                        className={cn(
                          "relative flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                          active
                            ? "bg-[rgb(255_120_31_/_0.1)]"
                            : "hover:bg-white",
                        )}
                      >
                        <HecomClienteAvatar
                          name={name}
                          avatarUrl={ticket.avatarUrl}
                          size="md"
                          className="h-12 w-12 text-[13px] shadow-sm ring-2 ring-white"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[14px] font-bold text-[var(--auth-text)]">
                              {name}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-[var(--auth-text-soft)]">
                              {formatTicketDate(
                                ticket.updatedAt ?? ticket.createdAt,
                              )}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-[var(--auth-text-muted)]">
                            {ticket.subject}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate text-[10.5px] font-semibold",
                              ticket.hasHolisticAccount === false
                                ? "text-amber-700"
                                : free
                                  ? "text-amber-700"
                                  : mine
                                    ? "text-emerald-700"
                                    : "text-[var(--auth-text-soft)]",
                            )}
                          >
                            {ticket.hasHolisticAccount === false
                              ? "Sin cuenta Holistic"
                              : !ticket.hasTicket || ticket.status === "none"
                                ? "Sin chat"
                                : free
                                  ? "Sin atender"
                                  : mine
                                    ? "Atendiendo vos"
                                    : `Agente: ${ticket.assignedUserDisplayName || ticket.assignedUserName || "otro"}`}
                            {ticket.hasTicket && ticket.status !== "none"
                              ? ` · ${TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}`
                              : ""}
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
          {ownedByOther ? (
            <p className="shrink-0 border-b border-amber-200/80 bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-900">
              Otro agente tiene este chat. Solo lectura hasta que lo libere.
            </p>
          ) : null}

          <ChatConversation
            messages={messages}
            inputValue={inputValue}
            sending={sending}
            loading={loadingThread}
            error={threadError}
            showBack={mobileShowChat}
            className="min-h-0 flex-1"
            title={selectedClientName ?? "Inbox Soporte"}
            subtitle={
              selected
                ? isUnassigned
                  ? "Sin agente · tomá el chat o respondé"
                  : iOwnSelected
                    ? "Lo estás atendiendo vos"
                    : `Atendido por ${assigneeLabel ?? "otro agente"}`
                : "Seleccioná un cliente en la lista"
            }
            avatarUrl={selected?.avatarUrl}
            headerActions={headerActions}
            onInputChange={setInputValue}
            onSend={(files) => void handleSend(files)}
            onBack={() => setMobileShowChat(false)}
            composerDisabled={
              Boolean(ownedByOther) || selected?.hasHolisticAccount === false
            }
            composerDisabledReason={
              selected?.hasHolisticAccount === false
                ? "Este cliente aún no tiene cuenta Holistic para recibir Soporte."
                : "Otro agente tiene este chat. Pedile que lo libere para responder."
            }
          />
        </section>
      </div>
      </div>
    </>
  );
}
