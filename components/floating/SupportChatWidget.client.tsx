"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { supportMock } from "@/features/support/mocks/support.mock";
import type { ChatMessage, SupportView } from "@/features/support/types/support.types";
import { ChatHome } from "@/features/support/components/ChatHome";
import { ChatConversation } from "@/features/support/components/ChatConversation";
import { ChatFaqCategories } from "@/features/support/components/ChatFaqCategories";
import { ChatFaqCategoryDetail } from "@/features/support/components/ChatFaqCategoryDetail";
import { ChatFaqArticleDetail } from "@/features/support/components/ChatFaqArticleDetail";

interface SupportChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenChange: (open: boolean) => void;
}

interface SupportTicketSummary {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
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

function greetingMessage(): ChatMessage {
  return {
    id: "support-greeting",
    role: "bot",
    text: "Hola, cuéntanos qué necesitas y crearemos un ticket para darle seguimiento.",
    timestamp: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function SupportChatWidget({
  isOpen,
  onToggle,
  onOpenChange,
}: SupportChatWidgetProps) {
  const [view, setView] = useState<SupportView>("home");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([greetingMessage()]);
  const [inputValue, setInputValue] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = supportMock.categories.find(
    (c) => c.id === selectedCategoryId,
  );
  const categoryArticles = supportMock.articles.filter(
    (a) => a.categoryId === selectedCategoryId,
  );
  const selectedArticle = supportMock.articles.find(
    (a) => a.id === selectedArticleId,
  );

  const loadConversation = useCallback(async () => {
    if (conversationLoaded || loadingConversation) return;
    setLoadingConversation(true);
    setError(null);
    try {
      const ticketsData = await apiClient<TicketsResponse>("/api/support/tickets");
      const activeTicket = ticketsData.tickets.find(
        (ticket) => !["closed", "resolved"].includes(ticket.status),
      ) ?? ticketsData.tickets[0];

      if (activeTicket) {
        setTicketId(activeTicket.id);
        const messagesData = await apiClient<MessagesResponse>(
          `/api/support/tickets/${activeTicket.id}/messages`,
        );
        setMessages(messagesData.messages.length > 0 ? messagesData.messages : [greetingMessage()]);
      } else {
        setMessages([greetingMessage()]);
      }
      setConversationLoaded(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo cargar el historial de soporte.",
      );
    } finally {
      setLoadingConversation(false);
    }
  }, [conversationLoaded, loadingConversation]);

  function handleClose() {
    onOpenChange(false);
    setView("home");
    setSelectedCategoryId(null);
    setSelectedArticleId(null);
  }

  function handleToggle() {
    if (isOpen) {
      handleClose();
    } else {
      onToggle();
      setView("home");
    }
  }

  async function openConversation() {
    setView("conversation");
    await loadConversation();
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
      timestamp: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
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
        setConversationLoaded(true);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
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

  function renderContent() {
    switch (view) {
      case "conversation":
        return (
          <ChatConversation
            messages={messages}
            inputValue={inputValue}
            sending={sending}
            loading={loadingConversation}
            error={error}
            onInputChange={setInputValue}
            onSend={handleSend}
            onBack={() => setView("home")}
          />
        );
      case "faqCategories":
        return (
          <ChatFaqCategories
            brandName={supportMock.brandName}
            categories={supportMock.categories}
            onSelectCategory={(id) => {
              setSelectedCategoryId(id);
              setView("faqCategoryDetail");
            }}
            onBack={() => setView("home")}
          />
        );
      case "faqCategoryDetail":
        return selectedCategory ? (
          <ChatFaqCategoryDetail
            categoryTitle={selectedCategory.title}
            articles={categoryArticles}
            onSelectArticle={(id) => {
              setSelectedArticleId(id);
              setView("faqArticleDetail");
            }}
            onBack={() => setView("faqCategories")}
          />
        ) : null;
      case "faqArticleDetail":
        return selectedArticle ? (
          <ChatFaqArticleDetail
            article={selectedArticle}
            onBack={() => setView("faqCategoryDetail")}
          />
        ) : null;
      default:
        return (
          <ChatHome
            brandName={supportMock.brandName}
            poweredByLabel={supportMock.poweredByLabel}
            categories={supportMock.categories}
            onOpenConversation={openConversation}
            onOpenFaqCategories={() => setView("faqCategories")}
            onSelectCategory={(id) => {
              setSelectedCategoryId(id);
              setView("faqCategoryDetail");
            }}
          />
        );
    }
  }

  return (
    <div className="relative">
      {isOpen && (
        <div
          className={cn(
            "absolute bottom-[calc(100%+10px)] right-0 w-[min(340px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl shadow-2xl shadow-black/20 ring-1 ring-slate-200/50 transition-all duration-200 ease-out sm:bottom-[calc(100%+12px)]",
          )}
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-white transition-colors hover:bg-black/40"
            aria-label="Cerrar soporte"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {renderContent()}
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={isOpen ? "Cerrar chat de soporte" : "Abrir chat de soporte"}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#10344a] text-white shadow-xl shadow-black/20 transition-transform duration-200 hover:scale-105 sm:h-14 sm:w-14"
      >
        {isOpen ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12c0 4.556 4.03 8.25 9 8.25a9.764 9.764 0 002.555-.337 5.972 5.972 0 003.235 1.057 5.969 5.969 0 00.474-.065 4.48 4.48 0 01-.978-2.025c-.09-.457.133-.901.467-1.226C18.57 16.178 19.5 14.189 19.5 12c0-4.556-4.03-8.25-9-8.25s-9 3.694-9 8.25z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
