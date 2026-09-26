"use client";

import { useState } from "react";

type ChatMessage = { role: "user" | "bot"; text: string };

const SUGGESTIONS = [
  "Pagos de hoy",
  "Recarga y fee de esta semana",
  "¿Qué clientes están activos hoy?",
  "¿Hay alertas?",
  "¿A quién podemos dar crédito?",
  "¿Quién está en rojo?",
];

export function OpsAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Pregúntame por la cartera. Leo los pagos de hoy, la recarga y el fee de la semana, las alertas y el score de un cliente con su historial de cobros.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setBusy(true);
    try {
      const response = await fetch("/api/ops/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.reply || data.error || "No pude responder.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "No pude conectar con el reporte. Intenta de nuevo." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-[1.25rem] border border-[#efe6dc] bg-[#fbf8f4]">
      <header className="border-b border-[#efe6dc] bg-white px-5 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
          Gerencia
        </p>
        <h1 className="mt-1 text-[1.25rem] font-semibold tracking-[-0.03em] text-[#1a1714]">
          Asistente de cartera
        </h1>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-[#625b54]">
          Pagos, clientes activos, alertas, crédito y score. Los números salen de Hecom, no de una respuesta inventada.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <p
              className={
                message.role === "user"
                  ? "max-w-[34rem] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#c2410c] px-4 py-2.5 text-[13.5px] leading-5 text-white"
                  : "max-w-[40rem] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-[#efe6dc] bg-white px-4 py-2.5 text-[13.5px] leading-5 text-[#1c1917]"
              }
            >
              {message.text}
            </p>
          </div>
        ))}
        {busy ? (
          <p className="text-[12px] text-[#8a8177]">Revisando la cartera…</p>
        ) : null}
      </div>

      <div className="border-t border-[#efe6dc] bg-white px-4 py-3 sm:px-6">
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              disabled={busy}
              onClick={() => void ask(item)}
              className="shrink-0 rounded-full border border-[#ffd7b8] bg-[#fff8f1] px-3 py-1.5 text-[12px] font-semibold text-[#9a3412] hover:bg-[#ffedd5] disabled:opacity-50"
            >
              {item}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Pregunta por un cliente o por la cartera"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#ece7e0] bg-white px-3 text-[14px] text-[#1c1917] outline-none focus:border-[#d47840]"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="h-11 rounded-xl bg-[#c2410c] px-4 text-[13px] font-semibold text-white hover:bg-[#9a3412] disabled:opacity-50"
          >
            Preguntar
          </button>
        </form>
      </div>
    </div>
  );
}
