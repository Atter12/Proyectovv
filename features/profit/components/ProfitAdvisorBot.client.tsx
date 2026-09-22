"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTION_KEYS = [
  "advisorSuggestOverview",
  "advisorSuggestCollections",
  "advisorSuggestSpend",
  "advisorSuggestCredit",
] as const;

/** Quita markdown ruidoso (** __ #) para leer más limpio. */
function plainReply(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "· ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function TypingDots({ label }: { label: string }) {
  return (
    <p
      className="inline-flex items-center gap-2 text-[12px] tracking-wide text-[#8a8177]"
      aria-live="polite"
    >
      <span className="flex items-center gap-1" aria-hidden>
        <span className="h-1 w-1 animate-pulse rounded-full bg-[#8a8177]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-[#8a8177] [animation-delay:180ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-[#8a8177] [animation-delay:360ms]" />
      </span>
      <span className="italic">{label}</span>
    </p>
  );
}

export function ProfitAdvisorBot({
  clienteName,
  from,
  to,
}: {
  clienteName: string;
  from: string;
  to: string;
}) {
  const t = useTranslations("profit");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  const ask = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || busy) return;
      setError(null);
      setBusy(true);
      setInput("");
      const prior = turns;
      setTurns([...prior, { role: "user", content: message }]);
      try {
        const res = await fetch("/api/profit/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            message,
            history: prior,
            from: from || undefined,
            to: to || undefined,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          reply?: string;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.reply) {
          throw new Error(json.error || t("advisorError"));
        }
        setTurns([
          ...prior,
          { role: "user", content: message },
          { role: "assistant", content: plainReply(json.reply) },
        ]);
      } catch (e) {
        setTurns(prior);
        setError(e instanceof Error ? e.message : t("advisorError"));
      } finally {
        setBusy(false);
      }
    },
    [busy, from, to, t, turns],
  );

  return (
    <section
      id="profit-advisor"
      className="overflow-hidden rounded-2xl border border-[#e6e1da] bg-white"
      aria-label={t("advisorTitle")}
    >
      <header className="flex items-end justify-between gap-4 border-b border-[#efeae3] px-6 py-5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9a9187]">
            {t("advisorEyebrow")}
          </p>
          <h2 className="mt-1.5 text-[1.15rem] font-medium tracking-[-0.02em] text-[#1c1917]">
            {t("advisorTitle")}
          </h2>
          <p className="mt-1 max-w-lg text-[12.5px] leading-5 text-[#6b645c]">
            {t("advisorSubtitle", { name: clienteName })}
          </p>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="flex max-h-[min(48vh,400px)] min-h-[220px] flex-col gap-4 overflow-y-auto px-6 py-5"
      >
        {turns.length === 0 ? (
          <div className="space-y-4">
            <p className="max-w-md text-[13.5px] leading-6 text-[#3f3a35]">
              {t("advisorWelcome", { name: clienteName })}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SUGGESTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(t(key))}
                  className="text-left text-[12.5px] text-[#1c1917] underline decoration-[#d6cfc6] underline-offset-[5px] transition hover:decoration-[#1c1917] disabled:opacity-40"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <p
              key={`${turn.role}-${i}`}
              className="ml-auto max-w-[80%] text-right text-[13px] leading-5 text-[#6b645c]"
            >
              {turn.content}
            </p>
          ) : (
            <p
              key={`${turn.role}-${i}`}
              className="max-w-[34rem] whitespace-pre-wrap border-l border-[#1c1917] pl-3 text-[13.5px] leading-6 text-[#1c1917]"
            >
              {turn.content}
            </p>
          ),
        )}

        {busy ? <TypingDots label={t("advisorTyping")} /> : null}
        {error ? (
          <p className="text-[12px] text-[#9f3a2f]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <form
        className="border-t border-[#efeae3] px-6 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <div className="flex items-end gap-4">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            maxLength={800}
            disabled={busy}
            placeholder={t("advisorPlaceholder")}
            className="max-h-28 min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2 text-[13.5px] text-[#1c1917] outline-none placeholder:text-[#b3aaa1] disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="mb-1 shrink-0 text-[12px] font-medium uppercase tracking-[0.16em] text-[#1c1917] transition hover:text-[#c45c26] disabled:text-[#c8c0b8]"
          >
            {t("advisorSend")}
          </button>
        </div>
        <p className="mt-1 text-[10px] tracking-wide text-[#b3aaa1]">
          {t("advisorFootnote")}
        </p>
      </form>
    </section>
  );
}
