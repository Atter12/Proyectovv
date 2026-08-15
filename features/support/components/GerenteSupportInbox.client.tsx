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
  organizationName: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
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

function emptyThread(): ChatMessage[] {
  return [
    {
      id: "inbox-empty",
      role: "bot",
      text: "Elegí un ticket a la izquierda. Tomá el chat (estilo Whaticket) y respondé.",
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
  const [statusFilter, setStatusFilter] = useState("active");
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
  const iOwnSelected =
    Boolean(selected?.assignedUserId) && selected?.assignedUserId === meId;
  const isUnassigned = selected && !selected.assignedUserId;
  const ownedByOther =
    selected?.assignedUserId && selected.assignedUserId !== meId;

  const filteredTickets = tickets.filter((ticket) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return [
      ticket.subject,
      ticket.organizationName,
      ticket.requesterEmail,
      ticket.requesterName,
      ticket.assignedUserName,
      ticket.assignedUserEmail,
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

  async function openTicket(id: string) {
    setSelectedId(id);
    setMobileShowChat(true);
    setLoadingThread(true);
    setThreadError(null);
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
                text: "Sin mensajes todavía.",
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
    if (!selectedId) return;
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
    if (!selectedId) return;
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
    setMessages((prev) => [...prev.filter((m) => m.id !== "inbox-empty"), optimistic]);

    try {
      const formData = new FormData();
      if (text) formData.set("message", text);
      formData.set("status", "pending");
      for (const file of files) formData.append("files", file);

      const res = await fetch(`/api/support/inbox/${selectedId}/messages`, {
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
    if (!selectedId) return;
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

  const assigneeLabel = selected?.assignedUserName || selected?.assignedUserEmail;

  return (
    <div className={dashboardClasses.page}>
      <header className="dashboard-surface-card rounded-[1rem] p-5 sm:p-6">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Gerente · Inbox (estilo Whaticket)
        </p>
        <h1 className="mt-1.5 text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.65rem]">
          Inbox Soporte
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
          Cola compartida: tomá el chat, atendé y se ve quién responde. El cliente
          recibe todo en su sección Soporte.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className={cn("space-y-4", mobileShowChat && "hidden lg:block")}>
          <div className="dashboard-surface-card rounded-[1rem] p-4 sm:p-5">
            <div className="flex flex-col gap-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cliente, mail, agente o asunto…"
                className="h-10 w-full rounded-lg border border-[var(--auth-input-border)] bg-white px-3 text-[14px] text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] focus:border-[var(--auth-accent)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/20"
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "unassigned", label: "Sin atender" },
                  { id: "mine", label: "Míos" },
                  { id: "active", label: "Activos" },
                  { id: "pending", label: "Pendientes" },
                  { id: "all", label: "Todos" },
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

            <div className="mt-4 space-y-2">
              {loading ? (
                <p className="py-8 text-center text-[14px] text-[var(--auth-text-muted)]">
                  Cargando inbox…
                </p>
              ) : filteredTickets.length === 0 ? (
                <p className="rounded-lg bg-[var(--surface-soft)] px-3 py-8 text-center text-[14px] text-[var(--auth-text-muted)]">
                  No hay tickets en este filtro.
                </p>
              ) : (
                filteredTickets.map((ticket) => {
                  const active = ticket.id === selectedId;
                  const mine = ticket.assignedUserId === meId;
                  const free = !ticket.assignedUserId;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => void openTicket(ticket.id)}
                      className={cn(
                        "flex w-full flex-col rounded-lg border px-3.5 py-3 text-left transition-colors",
                        active
                          ? "border-[var(--auth-accent)]/50 bg-[rgb(255_120_31_/_0.06)]"
                          : "border-[var(--auth-input-border)] bg-white hover:border-[var(--auth-accent)]/35",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-[14px] font-semibold text-[var(--auth-text)]">
                          {ticket.subject}
                        </p>
                        <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--auth-text-muted)]">
                          {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[12px] font-medium text-[var(--auth-text-muted)]">
                        {ticket.requesterName ||
                          ticket.requesterEmail ||
                          "Cliente"}
                        {ticket.organizationName
                          ? ` · ${ticket.organizationName}`
                          : ""}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-[11px] font-semibold",
                          free
                            ? "text-amber-700"
                            : mine
                              ? "text-emerald-700"
                              : "text-[var(--auth-text-soft)]",
                        )}
                      >
                        {free
                          ? "Sin atender — tomá el chat"
                          : mine
                            ? "Lo estás atendiendo vos"
                            : `Atendido por ${ticket.assignedUserName || ticket.assignedUserEmail || "otro agente"}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--auth-text-soft)]">
                        {formatTicketDate(ticket.updatedAt ?? ticket.createdAt)}
                      </p>
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
                {selected.requesterEmail ?? "Sin email"} ·{" "}
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
              liberarlo o pedirle que te lo pase.
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
              title={selected ? selected.subject : "Inbox Soporte"}
              subtitle={
                selected
                  ? isUnassigned
                    ? "Tomá el chat o respondé (al enviar se te asigna)."
                    : iOwnSelected
                      ? `Atendiendo vos · ${selected.requesterEmail ?? "cliente"}`
                      : `Atendido por ${assigneeLabel ?? "otro agente"}`
                  : "Seleccioná un ticket para atender."
              }
              onInputChange={setInputValue}
              onSend={(files) => void handleSend(files)}
              onBack={() => setMobileShowChat(false)}
              composerDisabled={Boolean(ownedByOther)}
              composerDisabledReason="Otro agente tiene este chat. Pedile que lo libere para responder."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
