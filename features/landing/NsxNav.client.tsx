"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";
import { cn } from "@/lib/cn";
import { NsxBtnPrimary } from "./NsxButtons";

const NAV = [
  { href: "#soluciones", label: "Soluciones" },
  { href: "#proceso", label: "Proceso" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#resultados", label: "Resultados" },
] as const;

export function NsxNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
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
        "fixed left-1/2 z-50 w-[min(100%-1.25rem,1290px)] -translate-x-1/2 rounded-full backdrop-blur-[25px] transition-all duration-500",
        scrolled ? "top-2" : "top-5",
      )}
    >
      <div className="flex w-full items-center justify-between rounded-full bg-white px-2.5 py-2.5 shadow-[0_10px_40px_-18px_rgb(28_34_43_/_0.22)] xl:py-0">
        <Link
          href={routes.home}
          className="inline-flex items-center px-1.5"
          aria-label={siteConfig.name}
          onClick={() => setOpen(false)}
        >
          <HolisticLogo
            size={168}
            className="hidden h-9 w-auto max-w-[168px] object-contain object-left lg:block"
          />
          <HolisticLogo
            size={44}
            className="h-10 w-10 object-contain lg:hidden"
          />
        </Link>

        <nav className="hidden items-center xl:flex" aria-label="Principal">
          <ul className="flex items-center">
            {NAV.map((item) => (
              <li key={item.href} className="relative py-2.5">
                <a
                  href={item.href}
                  className="flex items-center gap-1 rounded-full border border-transparent px-4 py-2 text-[0.95rem] text-[rgb(26_26_28_/_0.6)] transition-colors hover:text-[var(--nsx-secondary)]"
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
            className="rounded-full px-3 py-2 text-[0.9rem] font-medium text-[rgb(26_26_28_/_0.6)] transition-colors hover:text-[var(--nsx-secondary)]"
          >
            Entrar
          </Link>
          <NsxBtnPrimary href={routes.register}>Empezar</NsxBtnPrimary>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--nsx-secondary)] xl:hidden"
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="mt-2 rounded-3xl border border-[var(--nsx-stroke)] bg-white p-4 shadow-xl xl:hidden">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-[0.95rem] font-medium text-[var(--nsx-secondary)]"
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
              className="nsx-btn nsx-btn-white w-full justify-center"
            >
              Entrar
            </Link>
            <NsxBtnPrimary
              href={routes.register}
              className="w-full justify-start"
            >
              Empezar
            </NsxBtnPrimary>
          </div>
        </div>
      ) : null}
    </header>
  );
}
