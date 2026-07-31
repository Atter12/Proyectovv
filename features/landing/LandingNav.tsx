"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "#soluciones", label: "Soluciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#herramientas", label: "Herramientas" },
  { href: "#opiniones", label: "Opiniones" },
] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--auth-divider)] bg-[rgb(248_250_252_/_0.92)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between gap-3 px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
        <Link
          href={routes.home}
          aria-label={siteConfig.name}
          className="min-w-0 shrink"
          onClick={() => setOpen(false)}
        >
          <AuthBrandMark tone="light" compact className="max-w-[132px] sm:max-w-[160px]" />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex lg:gap-7" aria-label="Principal">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={routes.login}
            className="hidden h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-white sm:inline-flex"
          >
            Iniciar sesión
          </Link>
          <Link
            href={routes.register}
            className="inline-flex h-9 items-center rounded-xl bg-[var(--auth-accent)] px-3.5 text-[13px] font-bold text-white shadow-[0_8px_18px_rgb(255_120_31_/_0.25)] transition-[filter] hover:brightness-[1.05] sm:h-10 sm:px-4 sm:text-[14px]"
          >
            Empezar
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--auth-divider)] bg-white text-[var(--auth-text)] lg:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">Menú</span>
            <span className="flex w-4 flex-col gap-1">
              <span
                className={cn(
                  "h-0.5 w-full rounded-full bg-current transition-transform",
                  open && "translate-y-1.5 rotate-45",
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-full rounded-full bg-current transition-opacity",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-full rounded-full bg-current transition-transform",
                  open && "-translate-y-1.5 -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        id="landing-mobile-nav"
        className={cn(
          "border-t border-[var(--auth-divider)] bg-white lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="mx-auto flex max-w-[1180px] flex-col gap-1 px-4 py-3" aria-label="Móvil">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-[15px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[#f8fafc]"
            >
              {item.label}
            </a>
          ))}
          <Link
            href={routes.login}
            onClick={() => setOpen(false)}
            className="mt-1 rounded-xl px-3 py-3 text-[15px] font-semibold text-[var(--auth-text-muted)] hover:bg-[#f8fafc] sm:hidden"
          >
            Iniciar sesión
          </Link>
        </nav>
      </div>
    </header>
  );
}
