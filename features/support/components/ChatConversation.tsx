import type { KeyboardEvent } from "react";
import type { ChatMessage } from "../types/support.types";

interface ChatConversationProps {
  messages: ChatMessage[];
  inputValue: string;
  sending?: boolean;
  loading?: boolean;
  error?: string | null;
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
    <div className="flex h-[480px] flex-col">
      <div className="bg-[#10344a] px-4 py-3">
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
        <p className="text-sm font-bold text-white">Escríbenos</p>
        <p className="text-xs text-white/70">
          Tu conversación queda guardada como ticket de soporte.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {loading ? (
          <p className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            Cargando historial…
          </p>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
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
                    : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
                }`}
              >
                <p>{message.text}</p>
                <p className={`mt-1 text-[10px] ${message.role === "user" ? "text-white/70" : "text-slate-400"}`}>
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

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            aria-label="Escribir mensaje"
            className="h-9 flex-1 rounded-full border border-slate-200 px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !inputValue.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)]/90 disabled:opacity-50"
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
