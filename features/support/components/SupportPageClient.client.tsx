"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { cn } from "@/lib/cn";
import { TICKET_STATUS_LABELS } from "@/lib/constants/status";
import { supportMock } from "@/features/support/mocks/support.mock";
import type { ChatMessage, SupportView } from "@/features/support/types/support.types";
import { ChatConversation } from "@/features/support/components/ChatConversation";
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
  error?: string;
}

interface PostMessageResponse {
  ok: boolean;
  message: ChatMessage;
  error?: string;
}

type PanelMode =
  | "home"
  | "chat"
  | Extract<
      SupportView,
      "faqCategories" | "faqCategoryDetail" | "faqArticleDetail"
    >;

function greetingMessage(): ChatMessage {
  return {
    id: "support-greeting",
    role: "bot",
    text: "Hola. Escribí tu consulta, pegá una captura (Ctrl+V) o adjuntá fotos/PDF. El equipo de Ads Holistic te responde acá.",
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

/** FAQ Holistic (renombre visual sin “Default”). */
const holisticFaqCategories = supportMock.categories.map((category) => ({
  ...category,
  title: category.title
    .replace(/Default Media/gi, "Ads Holistic")
    .replace(/Default/gi, "Holistic"),
}));

export function SupportPageClient() {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [panel, setPanel] = useState<PanelMode>("chat");
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [faqQuery, setFaqQuery] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([greetingMessage()]);
  const [inputValue, setInputValue] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = holisticFaqCategories.find(
    (c) => c.id === selectedCategoryId,
  );
  const categoryArticles = supportMock.articles
    .filter((a) => a.categoryId === selectedCategoryId)
    .map((article) => ({
      ...article,
      title: article.title.replace(/Default/gi, "Holistic"),
      content: article.content.replace(/Default Media/gi, "Ads Holistic").replace(/Default/gi, "Holistic"),
    }));
  const selectedArticle = categoryArticles.find((a) => a.id === selectedArticleId);

  const filteredFaqCategories = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return holisticFaqCategories;
    return holisticFaqCategories.filter((category) => {
      const articles = supportMock.articles.filter(
        (a) => a.categoryId === category.id,
      );
      return (
        category.title.toLowerCase().includes(q) ||
        articles.some(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.content.toLowerCase().includes(q),
        )
      );
    });
  }, [faqQuery]);

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
        messagesData.messages.length > 0
          ? messagesData.messages
          : [greetingMessage()],
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

  async function handleSend(files: File[] = []) {
    const text = inputValue.trim();
    if ((!text && files.length === 0) || sending) return;

    setSending(true);
    setError(null);
    setInputValue("");

    const optimistic: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text || (files.length ? "📎 Adjunto" : ""),
      timestamp: new Date().toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachments: files
        .filter((f) => f.type.startsWith("image/"))
        .map((file, index) => ({
          name: file.name,
          mimeType: file.type,
          path: `local-${index}`,
          bucket: "local",
          size: file.size,
          url: URL.createObjectURL(file),
        })),
    };
    setMessages((prev) => [
      ...prev.filter((msg) => msg.id !== "support-greeting"),
      optimistic,
    ]);

    try {
      const formData = new FormData();
      if (text) formData.set("message", text);
      for (const file of files) formData.append("files", file);

      if (!ticketId) {
        const res = await fetch("/api/support/tickets", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = (await res.json()) as CreateTicketResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "No se pudo crear el ticket.");
        }
        setTicketId(data.ticketId);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
        await loadTickets();
      } else {
        const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = (await res.json()) as PostMessageResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "No se pudo enviar el mensaje.");
        }
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
        await loadTickets();
      }
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setInputValue(text);
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  function renderFaqPanel() {
    switch (panel) {
      case "faqCategories":
        return (
          <div className="dashboard-surface-card overflow-hidden rounded-[1rem]">
            <div className="border-b border-[var(--auth-divider)] bg-[linear-gradient(135deg,#1a1008_0%,#2a1810_55%,#e8451a_160%)] px-4 py-3">
              <button
                type="button"
                onClick={() => setPanel("home")}
                className="mb-2 flex items-center gap-1 text-xs text-white/80 hover:text-white"
              >
                ← Volver
              </button>
              <p className="text-sm font-bold text-white">Preguntas frecuentes</p>
              <p className="text-xs text-white/70">Guías rápidas de Ads Holistic</p>
            </div>
            <div className="p-4">
              <input
                type="search"
                value={faqQuery}
                onChange={(e) => setFaqQuery(e.target.value)}
                placeholder="Buscar en FAQ…"
                className="mb-3 h-10 w-full rounded-lg border border-[var(--auth-input-border)] bg-white px-3 text-[14px] text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] focus:border-[var(--auth-accent)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/20"
              />
              <ul className="space-y-1">
                {filteredFaqCategories.map((category) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setPanel("faqCategoryDetail");
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-[var(--auth-text)] transition-colors hover:bg-[var(--surface-soft)]"
                    >
                      <span>{category.title}</span>
                      <span className="text-[var(--auth-text-soft)]">→</span>
                    </button>
                  </li>
                ))}
                {filteredFaqCategories.length === 0 ? (
                  <li className="px-3 py-6 text-center text-[13px] text-[var(--auth-text-muted)]">
                    No hay resultados para “{faqQuery}”.
                  </li>
                ) : null}
              </ul>
            </div>
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
            setFaqQuery("");
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
              Buscá guías antes de abrir un ticket
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
    <div className="dashboard-surface-card h-full min-h-[560px] overflow-hidden rounded-[1.25rem] shadow-[0_16px_40px_rgb(15_23_42_/_0.06)]">
      <ChatConversation
        messages={messages}
        inputValue={inputValue}
        sending={sending}
        loading={loadingConversation}
        error={error}
        showBack={mobileShowChat}
        className="h-[min(760px,calc(100vh-11rem))] min-h-[560px]"
        title={ticketId ? "Conversación" : "Nueva consulta"}
        subtitle="Escribí, pegá capturas (Ctrl+V) o adjuntá fotos/PDF. Respondemos desde Soporte Holistic."
        onInputChange={setInputValue}
        onSend={(files) => void handleSend(files)}
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
          Chat interno de Ads Holistic: mensajes, fotos y archivos. Sin WhatsApp.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn(mobileShowChat && "hidden lg:block")}>{leftColumn}</div>
        <div
          className={cn(
            "min-w-0",
            !mobileShowChat &&
              panel !== "chat" &&
              faqMode &&
              "hidden lg:block",
          )}
        >
          {chatColumn}
        </div>
      </div>
    </div>
  );
}
