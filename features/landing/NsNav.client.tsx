"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "#servicios", label: "Servicios" },
  { href: "#proceso", label: "Proceso" },
  { href: "#por-que", label: "Por qué" },
  { href: "#resultados", label: "Resultados" },
  { href: "#opiniones", label: "Opiniones" },
] as const;

export function NsNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
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
        "fixed left-1/2 z-50 w-[min(100%-1.25rem,1290px)] -translate-x-1/2 transition-all duration-500",
        scrolled ? "top-2" : "top-5",
      )}
    >
      <div className="flex items-center justify-between rounded-full border border-[var(--ns-stroke)] bg-[var(--ns-accent)] px-2.5 py-2.5 shadow-[0_10px_40px_-16px_rgb(28_34_43_/_0.18)] xl:py-0">
        <Link
          href={routes.home}
          className="inline-flex min-w-0 items-center px-1.5"
          aria-label={siteConfig.name}
          onClick={() => setOpen(false)}
        >
          <Image
            src={siteConfig.logoSrc}
            alt={siteConfig.name}
            width={168}
            height={40}
            priority
            className="hidden h-8 w-auto object-contain lg:block"
          />
          <Image
            src={siteConfig.logoSrc}
            alt=""
            width={40}
            height={40}
            priority
            className="h-9 w-9 object-contain lg:hidden"
          />
        </Link>

        <nav className="hidden items-center xl:flex" aria-label="Principal">
          <ul className="flex items-center">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="flex items-center rounded-full border border-transparent px-4 py-2 text-[0.95rem] text-[var(--ns-muted)] transition-colors hover:border-[var(--ns-stroke)] hover:text-[var(--ns-secondary)]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <Link
            href={routes.login}
            className="rounded-full px-3 py-2 text-[0.9rem] font-medium text-[var(--ns-muted)] transition-colors hover:text-[var(--ns-secondary)]"
          >
            Entrar
          </Link>
          <Link
            href={routes.register}
            className="ns-btn ns-btn-md ns-btn-primary"
          >
            Empezar
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--ns-secondary)] xl:hidden"
          aria-expanded={open}
          aria-controls="ns-mobile-nav"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menú</span>
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            {open ? (
              <path
                strokeLinecap="round"
                d="M6 6l12 12M18 6L6 18"
              />
            ) : (
              <path
                strokeLinecap="round"
                d="M4 7h16M4 12h16M4 17h16"
              />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div
          id="ns-mobile-nav"
          className="mt-2 rounded-3xl border border-[var(--ns-stroke)] bg-white p-4 shadow-[0_20px_60px_-20px_rgb(28_34_43_/_0.25)] xl:hidden"
        >
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-[0.95rem] font-medium text-[var(--ns-secondary)] hover:bg-[var(--ns-bg-2)]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2">
            <Link
              href={routes.login}
              onClick={() => setOpen(false)}
              className="ns-btn ns-btn-md ns-btn-white w-full"
            >
              Entrar
            </Link>
            <Link
              href={routes.register}
              onClick={() => setOpen(false)}
              className="ns-btn ns-btn-md ns-btn-primary w-full"
            >
              Empezar
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
