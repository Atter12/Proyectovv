"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocaleAction } from "@/app/actions/locale";
import { locales, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";

const LOCALE_SHORT: Record<AppLocale, string> = {
  es: "ES",
  en: "EN",
  "pt-BR": "PT",
};

/** Compact language control for the dashboard topbar (left of notifications). */
export function LocaleSwitcherTopbar() {
  const t = useTranslations("common");
  const tLocale = useTranslations("common.locale");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function onChange(next: AppLocale) {
    if (next === locale) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("language")}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--auth-border)] bg-white px-2.5 text-[var(--auth-text-muted)] transition-colors",
          "hover:bg-[var(--auth-bg)] hover:text-[var(--auth-text)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35",
          open && "border-[var(--auth-accent)]/35 bg-[var(--auth-bg)] text-[var(--auth-text)]",
          pending && "opacity-60",
        )}
      >
        <svg
          className="h-[18px] w-[18px] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21a9 9 0 100-18 9 9 0 000 18z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.7 3.75 5.7 3.75 9S14.5 18.3 12 21c-2.5-2.7-3.75-5.7-3.75-9S9.5 5.7 12 3z"
          />
        </svg>
        <span className="text-[12px] font-bold tracking-wide text-[var(--auth-text)]">
          {LOCALE_SHORT[locale]}
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t("language")}
          className="absolute right-0 z-40 mt-2 w-[200px] overflow-hidden rounded-xl border border-[var(--auth-border)] bg-white p-1.5 shadow-[0_18px_40px_rgb(28_25_23_/_0.12)]"
        >
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--auth-text-soft)]">
            {t("language")}
          </p>
          {locales.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={active}
                disabled={pending}
                onClick={() => onChange(code)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]"
                    : "text-[var(--auth-text)] hover:bg-[var(--auth-bg)]",
                )}
              >
                <span>{tLocale(code)}</span>
                <span className="text-[11px] font-bold tracking-wide text-[var(--auth-text-soft)]">
                  {LOCALE_SHORT[code]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Inline language chips (e.g. inside a menu). */
export function LocaleSwitcher() {
  const t = useTranslations("common");
  const tLocale = useTranslations("common.locale");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: AppLocale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div className="px-3 py-2">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--auth-text-soft)]">
        {t("language")}
      </p>
      <div className="flex flex-wrap gap-1">
        {locales.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              disabled={pending || active}
              onClick={() => onChange(code)}
              className={cn(
                "rounded-md px-2 py-1 text-[12px] font-semibold transition-colors",
                active
                  ? "bg-[var(--auth-accent)] text-white"
                  : "bg-[var(--auth-bg)] text-[var(--auth-text-muted)] hover:bg-[var(--auth-border)]/40 hover:text-[var(--auth-text)]",
                pending && "opacity-60",
              )}
              aria-pressed={active}
            >
              {tLocale(code)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
