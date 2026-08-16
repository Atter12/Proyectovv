"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { cn } from "@/lib/cn";
import { TICKET_STATUS_LABELS } from "@/lib/constants/status";
import type { ChatMessage } from "@/features/support/types/support.types";
import { ChatConversation } from "@/features/support/components/ChatConversation";

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
}

function formatTicketDate(value: string) {
  try {
    return new Date(value).toLocaleString("es", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
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
  return (
    ticket.assignedUserDisplayName ||
    ticket.assignedUserName ||
    null
  );
}

function emptyThread(): ChatMessage[] {
  return [
    {
      id: "inbox-empty",
      role: "bot",
      text: "Elegí un cliente a la izquierda. Tomá el chat y respondé.",
      timestamp: new Date().toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      senderName: "Sistema",
      senderKind: "system",
    },
  ];
}

export function GerenteSupportInbox() {
  const [tickets, setTickets] = useState<InboxTicket[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [claiming, setClaiming] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(emptyThread());
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
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
  const isUnassigned = Boolean(hasRealTicket && selected && !selected.assignedUserId);
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

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Error al cargar inbox.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

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
            : "Todavía no hay mensajes con este cliente. Escribí abajo para iniciar el chat; le llega a su Soporte Holistic.",
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
    if (!selectedId || selectedId.startsWith("org:")) return;
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
    if (!selectedId || selectedId.startsWith("org:")) return;
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

  return (
    <div className={dashboardClasses.page}>
      <header className="dashboard-surface-card rounded-[1rem] p-5 sm:p-6">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Gerente · Inbox
        </p>
        <h1 className="mt-1.5 text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.65rem]">
          Inbox Soporte
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
          Clientes de Hecom Club. Al responderles, el mensaje llega a su Soporte
          Holistic.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className={cn("space-y-4", mobileShowChat && "hidden lg:block")}>
          <div className="dashboard-surface-card rounded-[1rem] p-4 sm:p-5">
            <div className="flex flex-col gap-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre de cliente…"
                className="h-10 w-full rounded-lg border border-[var(--auth-input-border)] bg-white px-3 text-[14px] text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] focus:border-[var(--auth-accent)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/20"
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "Todos" },
                  { id: "unassigned", label: "Sin atender" },
                  { id: "mine", label: "Míos" },
                  { id: "active", label: "Activos" },
                  { id: "pending", label: "Pendientes" },
                  { id: "resolved", label: "Resueltos" },
                  { id: "closed", label: "Cerrados" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-semibold transition-colors",
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
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-1.5">
              {loading ? (
                <p className="py-8 text-center text-[14px] text-[var(--auth-text-muted)]">
                  Cargando clientes…
                </p>
              ) : filteredTickets.length === 0 ? (
                <p className="rounded-lg bg-[var(--surface-soft)] px-3 py-8 text-center text-[14px] text-[var(--auth-text-muted)]">
                  No hay clientes en este filtro.
                </p>
              ) : (
                filteredTickets.map((ticket) => {
                  const active = ticket.id === selectedId;
                  const mine = ticket.assignedUserId === meId;
                  const free = !ticket.assignedUserId;
                  const name = clientLabel(ticket);
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => void openTicket(ticket.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                        active
                          ? "border-[var(--auth-accent)]/50 bg-[rgb(255_120_31_/_0.06)]"
                          : "border-transparent hover:bg-[var(--surface-soft)]",
                      )}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a1810_0%,#e8451a_120%)] text-[13px] font-bold text-white"
                      >
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate text-[14px] font-semibold text-[var(--auth-text)]">
                            {name}
                          </span>
                          <span className="shrink-0 text-[11px] text-[var(--auth-text-soft)]">
                            {formatTicketDate(ticket.updatedAt ?? ticket.createdAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--auth-text-muted)]">
                          {ticket.subject}
                          {ticket.requesterEmail
                            ? ` · ${ticket.requesterEmail}`
                            : ""}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block text-[11px] font-semibold",
                            ticket.hasHolisticAccount === false
                              ? "text-amber-700"
                              : !ticket.hasTicket || ticket.status === "none"
                                ? "text-[var(--auth-text-soft)]"
                                : free
                                  ? "text-amber-700"
                                  : mine
                                    ? "text-emerald-700"
                                    : "text-[var(--auth-text-soft)]",
                          )}
                        >
                          {ticket.hasHolisticAccount === false
                            ? "Sin cuenta Holistic aún"
                            : !ticket.hasTicket || ticket.status === "none"
                              ? "Sin chat todavía"
                              : free
                                ? "Sin atender"
                                : mine
                                  ? "Lo estás atendiendo"
                                  : `Atendido por ${ticket.assignedUserDisplayName || ticket.assignedUserName || "otro agente"}`}
                          {ticket.hasTicket && ticket.status !== "none"
                            ? ` · ${TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className={cn("min-w-0", !mobileShowChat && "hidden lg:block")}>
          {selected ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-[13px] font-medium text-[var(--auth-text-muted)]">
                <span className="font-semibold text-[var(--auth-text)]">
                  {selectedClientName}
                </span>
                {selected.requesterEmail ? (
                  <span className="text-[var(--auth-text-soft)]">
                    {" "}
                    · {selected.requesterEmail}
                  </span>
                ) : null}
                {" · "}
                {TICKET_STATUS_LABELS[selected.status] ?? selected.status}
                {assigneeLabel ? ` · Agente: ${assigneeLabel}` : " · Sin agente"}
              </p>

              {isUnassigned ? (
                <button
                  type="button"
                  disabled={claiming}
                  onClick={() => void claimOrRelease("claim")}
                  className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--brand-primary-deep)] disabled:opacity-50"
                >
                  {claiming ? "Tomando…" : "Tomar chat"}
                </button>
              ) : null}
              {iOwnSelected ? (
                <button
                  type="button"
                  disabled={claiming}
                  onClick={() => void claimOrRelease("release")}
                  className="rounded-lg border border-[var(--auth-input-border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--auth-text-muted)] hover:text-[var(--auth-text)] disabled:opacity-50"
                >
                  Liberar
                </button>
              ) : null}

              {[
                { id: "open", label: "Abrir" },
                { id: "pending", label: "Pendiente" },
                { id: "resolved", label: "Resuelto" },
                { id: "closed", label: "Cerrar" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void setStatus(item.id)}
                  className="rounded-lg border border-[var(--auth-input-border)] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[var(--auth-text-muted)] hover:border-[var(--auth-accent)]/40 hover:text-[var(--auth-text)]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          {ownedByOther ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-900">
              Este chat lo tiene otro agente. Podés leerlo; para responder tiene que
              liberarlo.
            </p>
          ) : null}

          <div className="dashboard-surface-card overflow-hidden rounded-[1.25rem] shadow-[0_16px_40px_rgb(15_23_42_/_0.06)]">
            <ChatConversation
              messages={messages}
              inputValue={inputValue}
              sending={sending}
              loading={loadingThread}
              error={threadError}
              showBack={mobileShowChat}
              className="h-[min(760px,calc(100vh-11rem))] min-h-[560px]"
              title={selectedClientName ?? "Inbox Soporte"}
              subtitle={
                selected
                  ? isUnassigned
                    ? "Tomá el chat o respondé (al enviar se te asigna)."
                    : iOwnSelected
                      ? "Lo estás atendiendo vos"
                      : `Atendido por ${assigneeLabel ?? "otro agente"}`
                  : "Seleccioná un cliente a la izquierda."
              }
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
          </div>
        </div>
      </div>
    </div>
  );
}
