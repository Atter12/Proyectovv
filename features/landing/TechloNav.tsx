"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { TechloButton } from "./TechloButton";
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
    const onScroll = () => setScrolled(window.scrollY > 24);
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
        "fixed inset-x-0 top-0 z-50 transition-[background,box-shadow] duration-300",
        scrolled || open
          ? "bg-[var(--tl-theme-dark)] shadow-[0_8px_24px_rgb(4_13_67_/_0.35)]"
          : "bg-transparent",
      )}
    >
      <div className="tl-container flex h-16 items-center justify-between gap-3 sm:h-[4.5rem]">
        <Link
          href={routes.home}
          aria-label={siteConfig.name}
          onClick={() => setOpen(false)}
          className="brightness-0 invert"
        >
          <AuthBrandMark
            tone="light"
            compact
            className="max-w-[130px] sm:max-w-[150px]"
          />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[0.95rem] font-medium text-white/75 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={routes.login}
            className="hidden text-[0.95rem] font-medium text-white/80 hover:text-white sm:inline"
          >
            Entrar
          </Link>
          <TechloButton
            href={routes.login}
            label="Empezar"
            className="!px-4 !py-3 text-[0.875rem]"
          />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 text-white lg:hidden"
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
          className="border-t border-white/10 bg-[var(--tl-theme-dark)] px-5 py-4 lg:hidden"
          aria-label="Móvil"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-[1rem] font-medium text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
