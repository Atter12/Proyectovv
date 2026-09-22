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
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, open, busy]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

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
          { role: "assistant", content: json.reply },
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
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-bold shadow-[0_16px_40px_-12px_rgb(28_25_23_/_0.55)] transition",
          open
            ? "bg-[#292524] text-white ring-1 ring-white/15"
            : "bg-[#1c1917] text-white hover:brightness-110",
        )}
        aria-expanded={open}
      >
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-full bg-[#ff781f] text-[12px] font-black text-[#1c1917]"
        >
          AI
        </span>
        {open ? t("advisorClose") : t("advisorOpen")}
      </button>

      {open ? (
        <div
          className="fixed bottom-[4.75rem] right-5 z-40 flex w-[min(100vw-1.5rem,400px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141210] text-white shadow-[0_28px_80px_-24px_rgb(0_0_0_/_0.85)]"
          role="dialog"
          aria-label={t("advisorTitle")}
        >
          <header className="border-b border-white/10 bg-gradient-to-br from-[#2a211c] to-[#141210] px-4 py-3.5">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#ffb080]">
              {t("advisorEyebrow")}
            </p>
            <h2 className="mt-0.5 text-[1.05rem] font-bold tracking-tight">
              {t("advisorTitle")}
            </h2>
            <p className="mt-1 text-[12px] leading-4 text-white/55">
              {t("advisorSubtitle", { name: clienteName })}
            </p>
          </header>

          <div
            ref={scrollerRef}
            className="flex max-h-[min(52vh,420px)] min-h-[220px] flex-col gap-3 overflow-y-auto px-3.5 py-3.5"
          >
            {turns.length === 0 ? (
              <div className="space-y-3">
                <p className="text-[13px] leading-5 text-white/70">
                  {t("advisorWelcome", { name: clienteName })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTION_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      disabled={busy}
                      onClick={() => void ask(t(key))}
                      className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-left text-[11.5px] font-semibold text-white/85 transition hover:border-[#ff781f]/50 hover:bg-[#ff781f]/10 disabled:opacity-50"
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
                  "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5",
                  turn.role === "user"
                    ? "ml-auto bg-[#ff781f] text-[#1c1917]"
                    : "mr-auto whitespace-pre-wrap border border-white/10 bg-white/[0.06] text-white/90",
                )}
              >
                {turn.content}
              </div>
            ))}

            {busy ? (
              <p className="text-[12px] font-medium text-[#ffb080]">
                {t("advisorThinking")}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-200" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <form
            className="border-t border-white/10 p-3"
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
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-[#ff781f]/55 disabled:opacity-60"
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
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#ff781f] px-3.5 text-[13px] font-bold text-[#1c1917] transition hover:brightness-110 disabled:opacity-40"
              >
                {t("advisorSend")}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-3 text-white/35">
              {t("advisorFootnote")}
            </p>
          </form>
        </div>
      ) : null}
    </>
  );
}
