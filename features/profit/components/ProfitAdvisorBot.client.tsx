"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

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
    <div
      className="mr-auto inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-[#f3efe9] px-3.5 py-2.5 text-[13px] text-[#5c564e]"
      aria-live="polite"
    >
      <span className="flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c45c26] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c45c26] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c45c26] [animation-delay:300ms]" />
      </span>
      <span>{label}</span>
    </div>
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
      className="overflow-hidden rounded-2xl border border-[#ece7e0] bg-white shadow-[0_10px_28px_-18px_rgb(28_25_23_/_0.35)]"
      aria-label={t("advisorTitle")}
    >
      <header className="border-b border-[#f0ebe4] bg-[#faf7f3] px-5 py-4 sm:px-6">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#c45c26]">
          {t("advisorEyebrow")}
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-[1.1rem] font-bold tracking-tight text-[#1c1917]">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-full bg-[#fff0e6] text-[11px] font-black text-[#c45c26]"
          >
            AI
          </span>
          {t("advisorTitle")}
        </h2>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-[#6b645c]">
          {t("advisorSubtitle", { name: clienteName })}
        </p>
      </header>

      <div
        ref={scrollerRef}
        className="flex max-h-[min(48vh,380px)] min-h-[200px] flex-col gap-2.5 overflow-y-auto bg-[#fcfbf9] px-4 py-4 sm:px-5"
      >
        {turns.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-5 text-[#5c564e]">
              {t("advisorWelcome", { name: clienteName })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(t(key))}
                  className="rounded-full border border-[#e8dfd4] bg-white px-3 py-1.5 text-left text-[11.5px] font-semibold text-[#3f3a35] transition hover:border-[#c45c26]/40 hover:bg-[#fff7f0] disabled:opacity-50"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn, i) => (
          <div
            key={`${turn.role}-${i}`}
            className={cn(
              "max-w-[90%] px-3.5 py-2.5 text-[13px] leading-5",
              turn.role === "user"
                ? "ml-auto rounded-2xl rounded-br-md bg-[#c45c26] text-white"
                : "mr-auto whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white text-[#2a2622] ring-1 ring-[#ece7e0]",
            )}
          >
            {turn.content}
          </div>
        ))}

        {busy ? <TypingDots label={t("advisorTyping")} /> : null}
        {error ? (
          <p
            className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      <form
        className="border-t border-[#f0ebe4] bg-white p-4 sm:px-5"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            maxLength={800}
            disabled={busy}
            placeholder={t("advisorPlaceholder")}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-[#e8dfd4] bg-[#faf7f3] px-3 py-2.5 text-[13px] text-[#1c1917] outline-none placeholder:text-[#9a9187] focus:border-[#c45c26]/50 focus:bg-white disabled:opacity-60"
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
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#c45c26] px-3.5 text-[13px] font-bold text-white transition hover:brightness-105 disabled:opacity-40"
          >
            {t("advisorSend")}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-3 text-[#9a9187]">
          {t("advisorFootnote")}
        </p>
      </form>
    </section>
  );
}
