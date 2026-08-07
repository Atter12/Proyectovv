"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "#soluciones", label: "Soluciones" },
  { href: "#proceso", label: "Proceso" },
  { href: "#herramientas", label: "Herramientas" },
  { href: "#opiniones", label: "Opiniones" },
] as const;

export function TechloNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background,border-color,box-shadow] duration-300",
        scrolled || open
          ? "border-white/10 bg-[var(--tl-nav-dark)] shadow-[0_10px_30px_rgb(0_0_0_/_0.22)]"
          : "border-transparent bg-[var(--tl-nav-dark)]",
      )}
    >
      <div className="tl-container grid h-16 grid-cols-[1fr_auto] items-center gap-4 sm:h-[4.25rem] lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href={routes.home}
          aria-label={siteConfig.name}
          onClick={() => setOpen(false)}
          className="justify-self-start"
        >
          <AuthBrandMark
            tone="dark"
            compact
            className="!justify-start max-w-[128px] sm:max-w-[148px]"
          />
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Principal"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3.5 py-2 text-[0.9rem] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 justify-self-end">
          <Link
            href={routes.login}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--tl-primary)] px-5 text-[0.9rem] font-semibold text-white shadow-[0_8px_18px_-10px_rgb(255_120_31_/_0.7)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
          >
            Entrar
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white transition-colors hover:bg-white/[0.06] lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="flex w-4 flex-col gap-1">
              <span
                className={cn(
                  "h-0.5 w-full bg-current transition-transform",
                  open && "translate-y-1.5 rotate-45",
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-full bg-current transition-opacity",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-full bg-current transition-transform",
                  open && "-translate-y-1.5 -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <nav
          className="border-t border-white/10 bg-[var(--tl-nav-dark)] px-5 py-3 lg:hidden"
          aria-label="Móvil"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-3 text-[0.95rem] font-medium text-white/85 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <Link
            href={routes.login}
            onClick={() => setOpen(false)}
            className="mt-2 mb-1 flex h-11 items-center justify-center rounded-lg bg-[var(--tl-primary)] text-[0.95rem] font-semibold text-white"
          >
            Entrar
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
