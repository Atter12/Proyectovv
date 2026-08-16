"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { cn } from "@/lib/cn";
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
  | "chat"
  | Extract<
      SupportView,
      "faqCategories" | "faqCategoryDetail" | "faqArticleDetail"
    >;

const SUPPORT_NAME = "Soporte Holistic";

function greetingMessage(): ChatMessage {
  return {
    id: "support-greeting",
    role: "bot",
    text: `Hola. Este es el chat de ${SUPPORT_NAME}. Escribí tu consulta, pegá una captura (Ctrl+V) o adjuntá fotos/PDF. Te respondemos acá.`,
    timestamp: new Date().toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    senderName: SUPPORT_NAME,
    senderKind: "system",
  };
}

function pickActiveTicket(tickets: SupportTicketSummary[]): SupportTicketSummary | null {
  if (tickets.length === 0) return null;
  const openish = tickets.find((t) =>
    ["open", "pending"].includes(String(t.status).toLowerCase()),
  );
  return openish ?? tickets[0] ?? null;
}

/** FAQ Holistic (renombre visual sin “Default”). */
const holisticFaqCategories = supportMock.categories.map((category) => ({
  ...category,
  title: category.title
    .replace(/Default Media/gi, "Ads Holistic")
    .replace(/Default/gi, "Holistic"),
}));

export function SupportPageClient() {
  const [panel, setPanel] = useState<PanelMode>("chat");
  const [mobileShowChat, setMobileShowChat] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [faqQuery, setFaqQuery] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([greetingMessage()]);
  const [inputValue, setInputValue] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const selectedCategory = holisticFaqCategories.find(
    (c) => c.id === selectedCategoryId,
  );
  const categoryArticles = supportMock.articles
    .filter((a) => a.categoryId === selectedCategoryId)
    .map((article) => ({
      ...article,
      title: article.title.replace(/Default/gi, "Holistic"),
      content: article.content
        .replace(/Default Media/gi, "Ads Holistic")
        .replace(/Default/gi, "Holistic"),
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

  const openTicket = useCallback(async (ticket: SupportTicketSummary) => {
    setTicketId(ticket.id);
    setTicketStatus(ticket.status);
    setPanel("chat");
    setMobileShowChat(true);
    setLoadingConversation(true);
    setError(null);
    try {
      const messagesData = await apiClient<MessagesResponse>(
        `/api/support/tickets/${ticket.id}/messages`,
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
  }, []);

  const bootChat = useCallback(async () => {
    setLoadingConversation(true);
    setBootError(null);
    try {
      const data = await apiClient<TicketsResponse>("/api/support/tickets");
      const active = pickActiveTicket(data.tickets ?? []);
      if (active) {
        await openTicket(active);
        return;
      }
      setTicketId(null);
      setTicketStatus(null);
      setMessages([greetingMessage()]);
    } catch (err) {
      setBootError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo abrir Soporte Holistic.",
      );
      setMessages([greetingMessage()]);
    } finally {
      setLoadingConversation(false);
    }
  }, [openTicket]);

  useEffect(() => {
    void bootChat();
  }, [bootChat]);

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
          throw new Error(data.error ?? "No se pudo enviar el mensaje.");
        }
        setTicketId(data.ticketId);
        setTicketStatus("open");
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
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
        setTicketStatus("open");
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
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
                onClick={() => {
                  setPanel("chat");
                  setMobileShowChat(true);
                }}
                className="mb-2 flex items-center gap-1 text-xs text-white/80 hover:text-white"
              >
                ← Volver al chat
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
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Chats
        </p>
        <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
          Conversación
        </h2>

        {bootError ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800"
            role="alert"
          >
            {bootError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setPanel("chat");
            setMobileShowChat(true);
          }}
          className={cn(
            "mt-4 flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
            panel === "chat"
              ? "border-[var(--auth-accent)]/50 bg-[rgb(255_120_31_/_0.06)]"
              : "border-[var(--auth-input-border)] bg-white hover:border-[var(--auth-accent)]/35",
          )}
        >
          <span
            aria-hidden
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1a1008_0%,#e8451a_130%)] text-[12px] font-bold text-white"
          >
            SH
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-[var(--auth-text)]">
              {SUPPORT_NAME}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-[var(--auth-text-muted)]">
              Equipo Ads Holistic · respuesta en este chat
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFaqQuery("");
            setPanel("faqCategories");
            setMobileShowChat(false);
          }}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-[var(--auth-input-border)] bg-white px-3.5 py-3 text-left transition-colors hover:border-[var(--auth-accent)]/40"
        >
          <div>
            <p className="text-[14px] font-semibold text-[var(--auth-text)]">
              Preguntas frecuentes
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--auth-text-muted)]">
              Guías rápidas sin abrir ticket
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
        showBack={mobileShowChat && faqMode === false}
        className="h-[min(760px,calc(100vh-11rem))] min-h-[560px]"
        title={SUPPORT_NAME}
        subtitle="Escribí, pegá capturas (Ctrl+V) o adjuntá fotos/PDF."
        onInputChange={setInputValue}
        onSend={(files) => void handleSend(files)}
        onBack={() => setMobileShowChat(false)}
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
          {SUPPORT_NAME}
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
          Un solo chat con el equipo de Ads Holistic. Sin WhatsApp.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn(mobileShowChat && !faqMode && "hidden lg:block")}>
          {leftColumn}
        </div>
        <div
          className={cn(
            "min-w-0",
            (!mobileShowChat || faqMode) && "hidden lg:block",
          )}
        >
          {chatColumn}
        </div>
      </div>
    </div>
  );
}
