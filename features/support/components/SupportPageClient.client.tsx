"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { cn } from "@/lib/cn";
import { TICKET_STATUS_LABELS } from "@/lib/constants/status";
import { supportMock } from "@/features/support/mocks/support.mock";
import type { ChatMessage, SupportView } from "@/features/support/types/support.types";
import { ChatConversation } from "@/features/support/components/ChatConversation";
import { ChatFaqCategories } from "@/features/support/components/ChatFaqCategories";
import { ChatFaqCategoryDetail } from "@/features/support/components/ChatFaqCategoryDetail";
import { ChatFaqArticleDetail } from "@/features/support/components/ChatFaqArticleDetail";

interface SupportTicketSummary {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

interface TicketsResponse {
  ok: boolean;
  tickets: SupportTicketSummary[];
}

interface MessagesResponse {
  ok: boolean;
  messages: ChatMessage[];
}

interface CreateTicketResponse {
  ok: boolean;
  ticketId: string;
  message: ChatMessage;
}

interface PostMessageResponse {
  ok: boolean;
  message: ChatMessage;
}

type PanelMode = "home" | "chat" | Extract<SupportView, "faqCategories" | "faqCategoryDetail" | "faqArticleDetail">;

function greetingMessage(): ChatMessage {
  return {
    id: "support-greeting",
    role: "bot",
    text: "Hola, cuéntanos qué necesitas y crearemos un ticket para darle seguimiento.",
    timestamp: new Date().toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
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

export function SupportPageClient() {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [panel, setPanel] = useState<PanelMode>("home");
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([greetingMessage()]);
  const [inputValue, setInputValue] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = supportMock.categories.find((c) => c.id === selectedCategoryId);
  const categoryArticles = supportMock.articles.filter(
    (a) => a.categoryId === selectedCategoryId,
  );
  const selectedArticle = supportMock.articles.find((a) => a.id === selectedArticleId);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    try {
      const data = await apiClient<TicketsResponse>("/api/support/tickets");
      setTickets(data.tickets ?? []);
    } catch (err) {
      setTicketsError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudieron cargar tus tickets.",
      );
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function openTicket(id: string) {
    setPanel("chat");
    setMobileShowChat(true);
    setTicketId(id);
    setLoadingConversation(true);
    setError(null);
    try {
      const messagesData = await apiClient<MessagesResponse>(
        `/api/support/tickets/${id}/messages`,
      );
      setMessages(
        messagesData.messages.length > 0 ? messagesData.messages : [greetingMessage()],
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo cargar la conversación.",
      );
      setMessages([greetingMessage()]);
    } finally {
      setLoadingConversation(false);
    }
  }

  function startNewConversation() {
    setTicketId(null);
    setMessages([greetingMessage()]);
    setInputValue("");
    setError(null);
    setPanel("chat");
    setMobileShowChat(true);
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setInputValue("");

    const optimistic: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [
      ...prev.filter((msg) => msg.id !== "support-greeting"),
      optimistic,
    ]);

    try {
      if (!ticketId) {
        const data = await apiClient<CreateTicketResponse>("/api/support/tickets", {
          method: "POST",
          body: JSON.stringify({ message: text }),
        });
        setTicketId(data.ticketId);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
        await loadTickets();
      } else {
        const data = await apiClient<PostMessageResponse>(
          `/api/support/tickets/${ticketId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({ message: text }),
          },
        );
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
        await loadTickets();
      }
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setInputValue(text);
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo enviar el mensaje.",
      );
    } finally {
      setSending(false);
    }
  }

  function renderFaqPanel() {
    switch (panel) {
      case "faqCategories":
        return (
          <div className="overflow-hidden rounded-[1rem] ring-1 ring-[var(--border-subtle)]">
            <ChatFaqCategories
              brandName="Ads Holistic"
              categories={supportMock.categories}
              onSelectCategory={(id) => {
                setSelectedCategoryId(id);
                setPanel("faqCategoryDetail");
              }}
              onBack={() => setPanel("home")}
            />
          </div>
        );
      case "faqCategoryDetail":
        return selectedCategory ? (
          <div className="overflow-hidden rounded-[1rem] ring-1 ring-[var(--border-subtle)]">
            <ChatFaqCategoryDetail
              categoryTitle={selectedCategory.title}
              articles={categoryArticles}
              onSelectArticle={(id) => {
                setSelectedArticleId(id);
                setPanel("faqArticleDetail");
              }}
              onBack={() => setPanel("faqCategories")}
            />
          </div>
        ) : null;
      case "faqArticleDetail":
        return selectedArticle ? (
          <div className="overflow-hidden rounded-[1rem] ring-1 ring-[var(--border-subtle)]">
            <ChatFaqArticleDetail
              article={selectedArticle}
              onBack={() => setPanel("faqCategoryDetail")}
            />
          </div>
        ) : null;
      default:
        return null;
    }
  }

  const faqMode =
    panel === "faqCategories" ||
    panel === "faqCategoryDetail" ||
    panel === "faqArticleDetail";

  const leftColumn = (
    <div className="space-y-4">
      <div className="dashboard-surface-card rounded-[1rem] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
              Tus consultas
            </p>
            <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Tickets
            </h2>
          </div>
          <button
            type="button"
            onClick={startNewConversation}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-primary)] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--brand-primary-deep)]"
          >
            Nueva consulta
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setPanel("faqCategories");
            setMobileShowChat(false);
          }}
          className="mt-4 flex w-full items-center justify-between rounded-lg border border-[var(--auth-input-border)] bg-white px-3.5 py-3 text-left transition-colors hover:border-[var(--auth-accent)]/40"
        >
          <div>
            <p className="text-[14px] font-semibold text-[var(--auth-text)]">
              Preguntas frecuentes
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--auth-text-muted)]">
              Guías rápidas antes de abrir un ticket
            </p>
          </div>
          <svg
            className="h-4 w-4 shrink-0 text-[var(--auth-text-soft)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {ticketsError ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800"
            role="alert"
          >
            {ticketsError}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {ticketsLoading ? (
            <p className="py-6 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
              Cargando tickets…
            </p>
          ) : tickets.length === 0 ? (
            <p className="rounded-lg bg-[var(--surface-soft)] px-3 py-6 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
              Todavía no tenés consultas. Empezá una nueva o mirá las FAQ.
            </p>
          ) : (
            tickets.map((ticket) => {
              const active = ticketId === ticket.id && panel === "chat";
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
                  <p className="mt-1 text-[12px] text-[var(--auth-text-soft)]">
                    {formatTicketDate(ticket.updatedAt ?? ticket.createdAt)}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {faqMode ? renderFaqPanel() : null}
    </div>
  );

  const chatColumn = (
    <div className="dashboard-surface-card overflow-hidden rounded-[1rem]">
      <ChatConversation
        messages={messages}
        inputValue={inputValue}
        sending={sending}
        loading={loadingConversation}
        error={error}
        showBack={mobileShowChat}
        className="h-[min(640px,70vh)] min-h-[420px]"
        title={ticketId ? "Conversación" : "Nueva consulta"}
        subtitle="Escribí acá. El equipo de Ads Holistic responde desde Soporte."
        onInputChange={setInputValue}
        onSend={() => void handleSend()}
        onBack={() => {
          setMobileShowChat(false);
          setPanel("home");
        }}
      />
    </div>
  );

  return (
    <div className={dashboardClasses.page}>
      <header className="dashboard-surface-card rounded-[1rem] p-5 sm:p-6">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Soporte
        </p>
        <h1 className="mt-1.5 text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.65rem]">
          Ayuda y consultas
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
          Chateá con el equipo Holistic, abrí reclamos o revisá preguntas frecuentes.
          Todo queda en tickets dentro de Ads Holistic — sin WhatsApp.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className={cn(mobileShowChat && "hidden lg:block")}>{leftColumn}</div>
        <div className={cn(!mobileShowChat && panel !== "chat" && "hidden lg:block")}>
          {chatColumn}
        </div>
      </div>
    </div>
  );
}
