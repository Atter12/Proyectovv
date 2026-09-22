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
    <div
      className="mr-auto inline-flex items-center gap-2 rounded-full border border-[#f2dccd] bg-[#fff7f0] px-3 py-2 text-[12px] tracking-wide text-[#a54a1d]"
      aria-live="polite"
    >
      <span className="flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ed6b2d]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ed6b2d] [animation-delay:160ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ed6b2d] [animation-delay:320ms]" />
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
      className="relative overflow-hidden rounded-[1.4rem] border border-[#eadfd5] bg-[#fffdfb] shadow-[0_20px_60px_-36px_rgb(92_52_31_/_0.48)]"
      aria-label={t("advisorTitle")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#ff781f]/10 blur-3xl"
      />
      <header className="relative flex items-center gap-4 border-b border-[#eee3da] bg-[linear-gradient(120deg,#fff8f2_0%,#fffdfb_55%,#f8efe8_100%)] px-6 py-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1c1917] shadow-[0_8px_22px_-12px_rgb(28_25_23_/_0.75)]">
          <span className="text-[11px] font-black tracking-tight text-[#ff8a45]">
            AI
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#cf5a20]">
            {t("advisorEyebrow")}
          </p>
          <h2 className="mt-1 text-[1.15rem] font-bold tracking-[-0.025em] text-[#1c1917]">
            {t("advisorTitle")}
          </h2>
          <p className="mt-1 max-w-lg text-[12.5px] leading-5 text-[#6b645c]">
            {t("advisorSubtitle", { name: clienteName })}
          </p>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="relative flex max-h-[min(48vh,400px)] min-h-[220px] flex-col gap-4 overflow-y-auto bg-[linear-gradient(180deg,#fffdfb_0%,#fffaf6_100%)] px-6 py-5"
      >
        {turns.length === 0 ? (
          <div className="rounded-2xl border border-[#f0e5dc] bg-white/80 p-4 shadow-[0_10px_24px_-22px_rgb(28_25_23_/_0.5)]">
            <p className="max-w-md text-[13.5px] leading-6 text-[#3f3a35]">
              {t("advisorWelcome", { name: clienteName })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(t(key))}
                  className="rounded-full border border-[#eadfd5] bg-[#fffaf6] px-3 py-1.5 text-left text-[12px] font-semibold text-[#5c3b2b] transition hover:border-[#ed6b2d]/50 hover:bg-[#fff1e7] disabled:opacity-40"
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
              className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[#1c1917] px-3.5 py-2.5 text-[13px] leading-5 text-white shadow-[0_9px_22px_-17px_rgb(28_25_23_/_0.9)]"
            >
              {turn.content}
            </p>
          ) : (
            <p
              key={`${turn.role}-${i}`}
              className="max-w-[34rem] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-[#eedfd4] bg-white px-4 py-3 text-[13.5px] leading-6 text-[#2a2622] shadow-[0_10px_24px_-22px_rgb(28_25_23_/_0.6)]"
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
        className="relative border-t border-[#eee3da] bg-white px-5 py-4 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <div className="flex items-end gap-3 rounded-2xl border border-[#e9ded4] bg-[#fffaf6] px-3 py-2 transition focus-within:border-[#ed6b2d]/55 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#ff781f]/[0.07]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            maxLength={800}
            disabled={busy}
            placeholder={t("advisorPlaceholder")}
            className="max-h-28 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[13.5px] text-[#1c1917] outline-none placeholder:text-[#a79e95] disabled:opacity-50"
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
            className="mb-0.5 inline-flex h-9 shrink-0 items-center rounded-xl bg-[#ed6b2d] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_8px_18px_-12px_rgb(237_107_45_/_0.8)] transition hover:bg-[#d95b22] disabled:bg-[#e8ddd5] disabled:text-[#aaa096] disabled:shadow-none"
          >
            {t("advisorSend")}
          </button>
        </div>
        <p className="mt-2 px-1 text-[10px] tracking-wide text-[#aaa096]">
          {t("advisorFootnote")}
        </p>
      </form>
    </section>
  );
}
