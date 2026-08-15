import type { KeyboardEvent } from "react";
import type { ChatMessage } from "../types/support.types";
import { cn } from "@/lib/cn";

interface ChatConversationProps {
  messages: ChatMessage[];
  inputValue: string;
  sending?: boolean;
  loading?: boolean;
  error?: string | null;
  showBack?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onBack: () => void;
}

export function ChatConversation({
  messages,
  inputValue,
  sending = false,
  loading = false,
  error = null,
  showBack = true,
  className,
  title = "Escríbenos",
  subtitle = "Tu conversación queda guardada como ticket de soporte.",
  onInputChange,
  onSend,
  onBack,
}: ChatConversationProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className={cn("flex h-[480px] flex-col", className)}>
      <div className="bg-[linear-gradient(135deg,#050505_0%,#1a1008_70%,#e8451a_160%)] px-4 py-3">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 flex items-center gap-1 text-xs text-white/80 hover:text-white"
            aria-label="Volver"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Volver
          </button>
        ) : null}
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-white/70">{subtitle}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--surface-soft)] p-4">
        {loading ? (
          <p className="rounded-2xl bg-white px-3 py-2 text-sm text-[#6b645c] shadow-sm ring-1 ring-[var(--border-subtle)]">
            Cargando historial…
          </p>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-[#6b645c] shadow-sm ring-1 ring-[var(--border-subtle)]">
            Cuéntanos en qué podemos ayudarte y crearemos un ticket para darle seguimiento.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-[var(--brand-primary)] text-white"
                    : "bg-white text-[#3f3a34] shadow-sm ring-1 ring-[var(--border-subtle)]"
                }`}
              >
                <p>{message.text}</p>
                <p className={`mt-1 text-[10px] ${message.role === "user" ? "text-white/70" : "text-[#9a9187]"}`}>
                  {message.timestamp}
                </p>
              </div>
            </div>
          ))
        )}
        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="border-t border-[var(--border-subtle)] bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            aria-label="Escribir mensaje"
            className="h-9 flex-1 rounded-full border border-[var(--border-subtle)] px-4 text-sm text-[#141210] placeholder:text-[#9a9187] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !inputValue.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-deep)] disabled:opacity-50"
            aria-label="Enviar mensaje"
          >
            {sending ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
