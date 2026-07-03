import type { KeyboardEvent } from "react";
import type { ChatMessage } from "../types/support.types";

interface ChatConversationProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onBack: () => void;
}

export function ChatConversation({
  messages,
  inputValue,
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
          Back
        </button>
        <p className="text-sm font-bold text-white">Message Us!!!</p>
        <p className="text-xs text-white/70">
          We&apos;re currently away. Please leave us a message!
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-[#4056ff] text-white"
                  : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="Adjuntar archivo"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply here..."
            aria-label="Escribir mensaje"
            className="h-9 flex-1 rounded-full border border-slate-200 px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#4056ff] focus:outline-none focus:ring-2 focus:ring-[#4056ff]/20"
          />
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="Insertar emoji"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.008H9.375V9.75zm3 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.008H12V9.75z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onSend}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4056ff] text-white hover:bg-[#4056ff]/90"
            aria-label="Enviar mensaje"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
