"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
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
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-40 border-b bg-[var(--landing-paper)]",
        scrolled
          ? "border-[var(--landing-hairline)] shadow-[0_8px_22px_-11px_rgba(20,16,8,0.28)]"
          : "border-transparent",
      )}
      initial={reduce ? false : { y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[72rem] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link
          href={routes.home}
          aria-label={siteConfig.name}
          className="min-w-0 shrink"
          onClick={() => setOpen(false)}
        >
          <AuthBrandMark
            tone="light"
            compact
            className="max-w-[132px] sm:max-w-[160px]"
          />
        </Link>

        <nav
          className="hidden items-center gap-7 lg:flex"
          aria-label="Principal"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="font-register text-[0.9375rem] font-medium tracking-[-0.01em] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={routes.login}
            className="font-register hidden h-10 items-center rounded-md px-3 text-[0.9375rem] font-medium text-[var(--landing-ink)] transition-colors hover:text-[var(--landing-accent-text)] sm:inline-flex"
          >
            Entrar
          </Link>
          <Link href={routes.login} className="landing-cta-primary h-9 px-3.5 text-[0.8125rem] sm:h-10 sm:px-4 sm:text-[0.875rem]">
            Empezar
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--landing-hairline)] bg-white text-[var(--landing-ink)] lg:hidden"
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
          "border-t border-[var(--landing-hairline)] bg-white lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav
          className="mx-auto flex max-w-[72rem] flex-col gap-1 px-4 py-3"
          aria-label="Móvil"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="font-register rounded-md px-3 py-3 text-[1rem] font-medium text-[var(--landing-ink)] transition-colors hover:bg-[rgb(255_120_31_/_0.06)]"
            >
              {item.label}
            </a>
          ))}
          <Link
            href={routes.login}
            onClick={() => setOpen(false)}
            className="font-register mt-1 rounded-md px-3 py-3 text-[1rem] font-medium text-[var(--landing-muted)] hover:bg-[rgb(255_120_31_/_0.06)] sm:hidden"
          >
            Entrar
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
