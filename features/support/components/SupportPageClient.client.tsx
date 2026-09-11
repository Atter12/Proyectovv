"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { dashboardClasses } from "@/lib/ui/dashboard-classes";
import { cn } from "@/lib/cn";
import { supportMock } from "@/features/support/mocks/support.mock";
import { supportFaqForPersona } from "@/features/support/lib/support-faq-for-persona";
import type { ChatMessage, SupportView } from "@/features/support/types/support.types";
import type { DashboardPersona } from "@/types/dashboard-persona";
import { ChatConversation } from "@/features/support/components/ChatConversation";
import { ChatFaqCategoryDetail } from "@/features/support/components/ChatFaqCategoryDetail";
import { ChatFaqArticleDetail } from "@/features/support/components/ChatFaqArticleDetail";
import { useSupportThreadPolling } from "@/features/support/hooks/useSupportPolling";
import { supportChatTimestampsNow } from "@/lib/support/chat-time";

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

function greetingMessage(supportName: string, text: string): ChatMessage {
  return {
    id: "support-greeting",
    role: "bot",
    text,
    ...supportChatTimestampsNow(),
    senderName: supportName,
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

function applyHolisticRename(value: string) {
  return value
    .replace(/Default Media/gi, "Ads Holistic")
    .replace(/Default/gi, "Holistic");
}

export function SupportPageClient({
  persona = "cliente",
}: {
  persona?: DashboardPersona;
}) {
  const t = useTranslations("support");
  const tFaq = useTranslations("support.faq");
  const tNav = useTranslations("nav");
  const supportName = t("brandName");
  const greetingText = t("greeting", { name: supportName });

  const faqConfig = useMemo(
    () => supportFaqForPersona(supportMock, persona),
    [persona],
  );

  const holisticFaqCategories = useMemo(
    () =>
      faqConfig.categories.map((category) => {
        const fallback = applyHolisticRename(category.title);
        const known = (
          ["empezar", "dinero", "cuentas", "soporte"] as const
        ).includes(category.id as "empezar");
        return {
          ...category,
          title: known
            ? tFaq(`categories.${category.id as "empezar"}`)
            : fallback,
        };
      }),
    [faqConfig.categories, tFaq],
  );

  const localizedArticles = useMemo(
    () =>
      faqConfig.articles.map((article) => {
        const knownIds = [
          "que-es",
          "menu-cliente",
          "saldo-estimado",
          "como-recargar",
          "como-asignar",
          "fee",
          "ver-cuentas",
          "como-escribir",
          "tiempos",
        ] as const;
        type KnownArticleId = (typeof knownIds)[number];
        const known = (knownIds as readonly string[]).includes(article.id);
        const id = article.id as KnownArticleId;
        return {
          ...article,
          title: known
            ? tFaq(`articles.${id}.title`)
            : applyHolisticRename(article.title),
          content: known
            ? tFaq(`articles.${id}.content`)
            : applyHolisticRename(article.content),
          // Messages cover title/content only — avoid Spanish mock bullets in other locales.
          bullets: known ? [] : article.bullets.map(applyHolisticRename),
        };
      }),
    [faqConfig.articles, tFaq],
  );

  const [panel, setPanel] = useState<PanelMode>("chat");
  const [mobileShowChat, setMobileShowChat] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [faqQuery, setFaqQuery] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    greetingMessage(supportName, greetingText),
  ]);
  const [inputValue, setInputValue] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const buildGreeting = useCallback(
    () => greetingMessage(supportName, greetingText),
    [greetingText, supportName],
  );

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.id === "support-greeting") {
        return [buildGreeting()];
      }
      return prev.map((msg) =>
        msg.id === "support-greeting"
          ? { ...msg, text: greetingText, senderName: supportName }
          : msg,
      );
    });
  }, [buildGreeting, greetingText, supportName]);

  const selectedCategory = holisticFaqCategories.find(
    (c) => c.id === selectedCategoryId,
  );
  const categoryArticles = localizedArticles.filter(
    (a) => a.categoryId === selectedCategoryId,
  );
  const selectedArticle = categoryArticles.find((a) => a.id === selectedArticleId);

  const filteredFaqCategories = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return holisticFaqCategories;
    return holisticFaqCategories.filter((category) => {
      const articles = localizedArticles.filter(
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
  }, [faqQuery, holisticFaqCategories, localizedArticles]);

  const openTicket = useCallback(
    async (ticket: SupportTicketSummary) => {
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
            : [buildGreeting()],
        );
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : t("loadError"),
        );
        setMessages([buildGreeting()]);
      } finally {
        setLoadingConversation(false);
      }
    },
    [buildGreeting, t],
  );

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
      setMessages([buildGreeting()]);
    } catch (err) {
      setBootError(
        err instanceof ApiClientError ? err.message : t("openError"),
      );
      setMessages([buildGreeting()]);
    } finally {
      setLoadingConversation(false);
    }
  }, [buildGreeting, openTicket, t]);

  useEffect(() => {
    void bootChat();
  }, [bootChat]);

  const fetchLiveMessages = useCallback(async (): Promise<ChatMessage[] | null> => {
    if (!ticketId) return null;
    const messagesData = await apiClient<MessagesResponse>(
      `/api/support/tickets/${ticketId}/messages`,
    );
    return messagesData.messages ?? [];
  }, [ticketId]);

  useSupportThreadPolling({
    enabled:
      Boolean(ticketId) && !sending && !loadingConversation && !clearingChat,
    intervalMs: 2000,
    fetchMessages: fetchLiveMessages,
    onMessages: setMessages,
  });

  async function handleClearChat() {
    if (!ticketId || clearingChat) return;
    setClearingChat(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? t("clearError"));
      }
      setMessages([buildGreeting()]);
      setTicketStatus("open");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clearError"));
    } finally {
      setClearingChat(false);
    }
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
      text: text || (files.length ? `📎 ${t("attachment")}` : ""),
      ...supportChatTimestampsNow(),
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
          throw new Error(data.error ?? t("sendError"));
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
          throw new Error(data.error ?? t("sendError"));
        }
        setTicketStatus("open");
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setInputValue(text);
      setError(err instanceof Error ? err.message : t("sendError"));
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
                {t("backToChat")}
              </button>
              <p className="text-sm font-bold text-white">{t("faqTitle")}</p>
              <p className="text-xs text-white/70">{t("faqSubtitle")}</p>
            </div>
            <div className="p-4">
              <input
                type="search"
                value={faqQuery}
                onChange={(e) => setFaqQuery(e.target.value)}
                placeholder={t("searchFaq")}
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
                    {t("noFaqResults", { q: faqQuery })}
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
          {t("chats")}
        </p>
        <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
          {t("conversation")}
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
              {supportName}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-[var(--auth-text-muted)]">
              {t("teamHint")}
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
              {t("faqTitle")}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--auth-text-muted)]">
              {t("faqGuides")}
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
        title={supportName}
        subtitle={t("chatSubtitle")}
        onInputChange={setInputValue}
        onSend={(files) => void handleSend(files)}
        onClearChat={ticketId ? () => void handleClearChat() : undefined}
        clearingChat={clearingChat}
        onBack={() => setMobileShowChat(false)}
      />
    </div>
  );

  return (
    <div className={dashboardClasses.page}>
      <header className="border-b border-[var(--auth-divider)] pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
          {tNav("support")}
        </p>
        <h1 className="mt-1 text-[1.125rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.25rem]">
          {supportName}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-[var(--auth-text-muted)]">
          {t("pageSubtitle")}
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
