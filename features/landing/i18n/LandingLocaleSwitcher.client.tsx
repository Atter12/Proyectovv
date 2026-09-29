"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  landingLocaleCookieName,
  landingLocaleLabels,
  landingLocaleQueryParam,
  landingLocaleShort,
  landingLocales,
  type LandingLocale,
} from "./landing-locale";

function saveLandingLocale(locale: LandingLocale) {
  document.cookie = `${landingLocaleCookieName}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Selector de idioma de la landing (arriba a la derecha del nav). */
export function LandingLocaleSwitcher({
  locale,
  label,
}: {
  locale: LandingLocale;
  label: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
  }, [open]);

  function onChange(next: LandingLocale) {
    setOpen(false);
    if (next === locale) return;
    saveLandingLocale(next);
    // `?lang=` manda sobre la cookie: se quita para que valga la elección nueva.
    const url = new URL(window.location.href);
    if (url.searchParams.has(landingLocaleQueryParam)) {
      url.searchParams.delete(landingLocaleQueryParam);
      startTransition(() => router.replace(`${url.pathname}${url.search}${url.hash}`));
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-[0.85rem] font-semibold text-[var(--nsx-secondary,#1a1a1c)] transition-colors hover:bg-[rgb(26_26_28_/_0.05)]",
          open && "bg-[rgb(26_26_28_/_0.05)]",
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.7 3.75 5.7 3.75 9S14.5 18.3 12 21c-2.5-2.7-3.75-5.7-3.75-9S9.5 5.7 12 3z"
          />
        </svg>
        <span>{landingLocaleShort[locale]}</span>
        <svg className="h-3 w-3 opacity-60" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute right-0 z-[60] mt-2 w-44 overflow-hidden rounded-2xl border border-[var(--nsx-stroke,#e8e8ea)] bg-white p-1.5 shadow-[0_18px_40px_-12px_rgb(28_34_43_/_0.25)]"
        >
          {landingLocales.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={active}
                lang={code === "zh" ? "zh-CN" : code}
                onClick={() => onChange(code)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[0.9rem] font-medium transition-colors",
                  active
                    ? "bg-[rgb(26_26_28_/_0.06)] text-[var(--nsx-secondary,#1a1a1c)]"
                    : "text-[rgb(26_26_28_/_0.7)] hover:bg-[rgb(26_26_28_/_0.04)] hover:text-[var(--nsx-secondary,#1a1a1c)]",
                )}
              >
                <span>{landingLocaleLabels[code]}</span>
                {active ? (
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
