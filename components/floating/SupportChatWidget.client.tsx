"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { ChatMessage } from "@/features/support/types/support.types";
import type { DashboardPersona } from "@/types/dashboard-persona";
import { ChatConversation } from "@/features/support/components/ChatConversation";
import { useSupportThreadPolling } from "@/features/support/hooks/useSupportPolling";
import { supportChatTimestampsNow } from "@/lib/support/chat-time";
import { playSupportNotifySound } from "@/lib/support/notify-sound.client";

interface SupportChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  onOpenChange: (open: boolean) => void;
  persona?: DashboardPersona;
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

type RechargeChatState = "idle" | "awaiting_amount" | "awaiting_payment";

interface RechargeBotResponse {
  handled: boolean;
  state: RechargeChatState;
  replies: Array<{ id: string; text: string }>;
  qrImageUrl?: string;
  /** Recarga esperando pago: si existe, un adjunto es su comprobante. */
  pending?: { paymentIntentId: string; grossPenCents: number } | null;
}

/**
 * Sube la captura como comprobante de la recarga en curso.
 *
 * Mientras haya una recarga esperando pago, una imagen en el chat es el
 * comprobante — no una consulta para el gerente. Va al mismo endpoint que usa
 * el panel, asi que la analiza la misma IA y pasa por los mismos controles.
 */
async function uploadVoucherFromChat(
  paymentIntentId: string,
  file: File,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.set("proof", file);
    const res = await fetch(`/api/payments/intents/${paymentIntentId}/proof`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || data.error) return { ok: false, error: data.error };
    return { ok: true };
  } catch {
    return { ok: false, error: "No pude subir la captura. Revisá tu conexión." };
  }
}

/**
 * Espera a que la recarga se acredite y avisa.
 *
 * El cobro lo confirma un agente que corre fuera de la app, asi que el chat no
 * tiene forma de enterarse solo: sin esto el cliente se queda mirando
 * "validando..." para siempre, incluso despues de que el saldo ya entro.
 */
function watchRechargeUntilCredited(
  paymentIntentId: string,
  onResolved: (text: string) => void,
): () => void {
  const INTERVALO_MS = 4000;
  const MAX_INTENTOS = 150; // ~10 minutos
  let intentos = 0;
  let cancelado = false;
  let timer: ReturnType<typeof setTimeout>;

  const revisar = async () => {
    if (cancelado) return;
    intentos += 1;
    try {
      const res = await fetch(`/api/payments/intents/${paymentIntentId}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { paymentIntent?: { status?: string } };
      const estado = data.paymentIntent?.status;

      if (estado === "succeeded") {
        onResolved("🎉 ¡Listo! Confirmé tu pago y el saldo ya está en tu cartera.");
        return;
      }
      if (estado === "cancelled" || estado === "failed") {
        onResolved(
          "Esa recarga se cerró sin acreditarse. Si ya pagaste, escribime y un gerente la revisa.",
        );
        return;
      }
    } catch {
      // Un fallo de red puntual no corta la espera.
    }

    if (intentos >= MAX_INTENTOS) {
      onResolved(
        "Todavía no me llega la confirmación del banco. Escribime *ya pagué* en un rato y vuelvo a revisar.",
      );
      return;
    }
    timer = setTimeout(() => void revisar(), INTERVALO_MS);
  };

  timer = setTimeout(() => void revisar(), INTERVALO_MS);
  return () => {
    cancelado = true;
    clearTimeout(timer);
  };
}

/** Consulta si hay una recarga esperando pago. */
async function fetchPendingRecharge(): Promise<
  { paymentIntentId: string; grossPenCents: number } | null
> {
  try {
    const res = await fetch("/api/payments/recharge-chat", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RechargeBotResponse;
    return data.pending ?? null;
  } catch {
    return null;
  }
}

/**
 * Le pregunta al bot de recarga si quiere hacerse cargo del mensaje.
 *
 * Si algo falla devuelve null y el mensaje sigue al ticket de soporte: una
 * caida del bot nunca debe dejar al cliente sin poder escribirle a un humano.
 */
async function tryRechargeBot(
  message: string,
  state: RechargeChatState,
): Promise<RechargeBotResponse | null> {
  try {
    const res = await fetch("/api/payments/recharge-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message, state }),
    });
    if (!res.ok) return null;
    return (await res.json()) as RechargeBotResponse;
  } catch {
    return null;
  }
}

function greetingMessage(): ChatMessage {
  return {
    id: "support-greeting",
    role: "bot",
    text: "Hola 👋 Soy soporte Holistic. Escribí tu consulta y un gerente te responde acá.",
    ...supportChatTimestampsNow(),
  };
}

/**
 * Chat flotante del cliente: abre directo la conversación con soporte
 * (sin FAQs). Badge + sonido + preview al llegar mensaje del gerente.
 */
export function SupportChatWidget({
  isOpen,
  onToggle,
  onOpenChange,
}: SupportChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([greetingMessage()]);
  // Estado del bot de recarga. Es solo una pista para interpretar un "50"
  // suelto; el servidor revalida todo y no confia en este valor.
  const [rechargeState, setRechargeState] = useState<RechargeChatState>("idle");
  const [inputValue, setInputValue] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadFromStaff, setUnreadFromStaff] = useState(0);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const lastSeenStaffMsgIdRef = useRef<string | null>(null);
  const backgroundSeededRef = useRef(false);
  const router = useRouter();
  /** Corta la espera de acreditacion al desmontar o al empezar otra. */
  const stopWatchRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopWatchRef.current?.(), []);

  const loadConversation = useCallback(async (opts?: { force?: boolean }) => {
    if (!opts?.force && (conversationLoaded || loadingConversation)) return;
    setLoadingConversation(true);
    setError(null);
    try {
      const ticketsData = await apiClient<TicketsResponse>("/api/support/tickets");
      const activeTicket =
        ticketsData.tickets.find(
          (ticket) => !["closed", "resolved"].includes(ticket.status),
        ) ?? ticketsData.tickets[0];

      if (activeTicket) {
        setTicketId(activeTicket.id);
        const messagesData = await apiClient<MessagesResponse>(
          `/api/support/tickets/${activeTicket.id}/messages`,
        );
        const msgs = messagesData.messages ?? [];
        setMessages(msgs.length > 0 ? msgs : [greetingMessage()]);
        const lastStaff = [...msgs].reverse().find((m) => m.role === "bot");
        if (lastStaff) lastSeenStaffMsgIdRef.current = lastStaff.id;
      } else {
        setMessages([greetingMessage()]);
      }
      setConversationLoaded(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo cargar el chat de soporte.",
      );
    } finally {
      setLoadingConversation(false);
    }
  }, [conversationLoaded, loadingConversation]);

  const fetchLiveMessages = useCallback(async (): Promise<ChatMessage[] | null> => {
    if (!ticketId) return null;
    const messagesData = await apiClient<MessagesResponse>(
      `/api/support/tickets/${ticketId}/messages`,
    );
    return messagesData.messages ?? [];
  }, [ticketId]);

  useSupportThreadPolling({
    enabled: isOpen && Boolean(ticketId) && !sending && !loadingConversation,
    intervalMs: 2000,
    fetchMessages: fetchLiveMessages,
    onMessages: (updater) => {
      setMessages((prev) => {
        const next = updater(prev);
        const msgs = next.length > 0 ? next : [greetingMessage()];
        const lastStaff = [...msgs].reverse().find((m) => m.role === "bot");
        if (lastStaff) lastSeenStaffMsgIdRef.current = lastStaff.id;
        return msgs;
      });
      setUnreadFromStaff(0);
      setPreviewText(null);
    },
  });

  // Al abrir: ir directo al hilo (sin menú FAQ).
  useEffect(() => {
    if (!isOpen) return;
    void loadConversation({ force: !conversationLoaded });
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- open trigger

  // Cerrado: avisar si el gerente respondió.
  useEffect(() => {
    let cancelled = false;
    async function pollBackground() {
      if (isOpen) return;
      try {
        const ticketsData = await apiClient<TicketsResponse>(
          "/api/support/tickets",
        );
        const activeTicket =
          ticketsData.tickets.find(
            (ticket) => !["closed", "resolved"].includes(ticket.status),
          ) ?? ticketsData.tickets[0];
        if (!activeTicket || cancelled) return;
        if (!ticketId) setTicketId(activeTicket.id);

        const messagesData = await apiClient<MessagesResponse>(
          `/api/support/tickets/${activeTicket.id}/messages`,
        );
        const msgs = messagesData.messages ?? [];
        const lastStaff = [...msgs]
          .reverse()
          .find((m) => m.role === "bot" && m.id !== "support-greeting");
        if (!lastStaff) return;

        if (!backgroundSeededRef.current) {
          backgroundSeededRef.current = true;
          lastSeenStaffMsgIdRef.current = lastStaff.id;
          return;
        }

        if (lastStaff.id !== lastSeenStaffMsgIdRef.current) {
          lastSeenStaffMsgIdRef.current = lastStaff.id;
          setUnreadFromStaff((n) => n + 1);
          setPreviewText(
            (lastStaff.text || "Nuevo mensaje de soporte").slice(0, 80),
          );
          playSupportNotifySound();
        }
      } catch {
        // ignore
      }
    }

    void pollBackground();
    const id = window.setInterval(() => void pollBackground(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isOpen, ticketId]);

  function handleClose() {
    onOpenChange(false);
  }

  function openChat() {
    setUnreadFromStaff(0);
    setPreviewText(null);
    onToggle();
  }

  function handleToggle() {
    if (isOpen) {
      handleClose();
    } else {
      openChat();
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
      text: text || (files.length ? "📎 Adjunto" : ""),
      ...supportChatTimestampsNow(),
    };
    setMessages((prev) => [
      ...prev.filter((msg) => msg.id !== "support-greeting"),
      optimistic,
    ]);

    try {
      // Una imagen con una recarga en curso es el comprobante de pago, no una
      // consulta para el gerente. Va al validador, que es lo que el cliente
      // espera cuando el bot le acaba de pedir la captura.
      const imagen = files.find((file) => file.type.startsWith("image/"));
      if (imagen) {
        const pending = await fetchPendingRecharge();
        if (pending) {
          const subida = await uploadVoucherFromChat(pending.paymentIntentId, imagen);
          if (subida.ok) {
            // Queda esperando el aviso del banco y avisa cuando entre el saldo.
            stopWatchRef.current?.();
            stopWatchRef.current = watchRechargeUntilCredited(
              pending.paymentIntentId,
              (texto) => {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `bot-credited-${Date.now()}`,
                    role: "bot" as const,
                    text: texto,
                    ...supportChatTimestampsNow(),
                  },
                ]);
                router.refresh();
              },
            );
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-voucher-${Date.now()}`,
              role: "bot" as const,
              text: subida.ok
                ? [
                    "⏳ Recibí tu comprobante, estoy validando el pago...",
                    "_(Si demoro es porque voy en orden, esperame por favor)_",
                  ].join("\n")
                : (subida.error ?? "No pude procesar tu comprobante."),
              ...supportChatTimestampsNow(),
            },
          ]);
          setSending(false);
          return;
        }
      }

      // El bot de recarga va primero. Si se hace cargo, no se crea ticket: el
      // gerente no tiene por que recibir "quiero recargar". Cualquier otra
      // cosa sigue de largo al soporte de siempre.
      if (text && files.length === 0) {
        const bot = await tryRechargeBot(text, rechargeState);
        if (bot?.handled) {
          setRechargeState(bot.state);
          setMessages((prev) => [
            ...prev,
            ...bot.replies.map((reply, index) => ({
              id: reply.id,
              role: "bot" as const,
              text: reply.text,
              // El QR va colgado del primer mensaje, que es el que trae el
              // monto: se ve el numero y el codigo juntos.
              ...(index === 0 && bot.qrImageUrl
                ? {
                    attachments: [
                      {
                        name: "QR de Yape",
                        mimeType: "image/png",
                        path: bot.qrImageUrl,
                        bucket: "public",
                        size: 0,
                        url: bot.qrImageUrl,
                      },
                    ],
                  }
                : {}),
              ...supportChatTimestampsNow(),
            })),
          ]);
          setSending(false);
          return;
        }
      }

      const formData = new FormData();
      if (text) formData.set("message", text);
      for (const file of files) formData.append("files", file);

      if (!ticketId) {
        const res = await fetch("/api/support/tickets", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = (await res.json()) as CreateTicketResponse & {
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "No se pudo crear el chat.");
        }
        setTicketId(data.ticketId);
        setConversationLoaded(true);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
      } else {
        const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = (await res.json()) as PostMessageResponse & {
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "No se pudo enviar el mensaje.");
        }
        setMessages((prev) =>
          prev.map((msg) => (msg.id === optimistic.id ? data.message : msg)),
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      setInputValue(text);
      setError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : "No se pudo enviar el mensaje.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative flex flex-col items-end gap-2">
      {!isOpen && unreadFromStaff > 0 && previewText ? (
        <button
          type="button"
          onClick={openChat}
          className="max-w-[min(280px,calc(100vw-5rem))] rounded-2xl border border-[var(--border-subtle)] bg-white px-3 py-2.5 text-left shadow-xl shadow-black/15 ring-1 ring-black/5 transition hover:bg-[rgb(255_120_31_/_0.04)]"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand-primary)]">
            Nuevo mensaje · Soporte
          </p>
          <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-[var(--auth-text)]">
            {previewText}
          </p>
        </button>
      ) : null}

      {isOpen ? (
        <div
          className={cn(
            "w-[min(360px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/25 ring-1 ring-black/10",
          )}
        >
          <ChatConversation
            messages={messages}
            inputValue={inputValue}
            sending={sending}
            loading={loadingConversation}
            error={error}
            showBack={false}
            title="Soporte Holistic"
            subtitle="Chat directo con un gerente"
            onInputChange={setInputValue}
            onSend={(files) => void handleSend(files)}
            onBack={handleClose}
            emptyHint="Escribí tu mensaje. Un gerente te responde acá."
            className="h-[min(520px,70vh)] max-h-[70vh]"
            headerActions={
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar chat"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            }
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={isOpen ? "Cerrar chat de soporte" : "Abrir chat de soporte"}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white shadow-xl shadow-[rgb(255_120_31_/_0.4)] transition-transform duration-200 hover:scale-105 hover:bg-[var(--brand-primary-deep)] sm:h-14 sm:w-14"
      >
        {unreadFromStaff > 0 && !isOpen ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-[var(--brand-primary)] shadow">
            {unreadFromStaff > 9 ? "9+" : unreadFromStaff}
          </span>
        ) : null}
        {isOpen ? (
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
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
