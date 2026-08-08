"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { NsxBtnPrimary } from "./NsxButtons";

const NAV = [
  { label: "Company" },
  { label: "Inner pages" },
  { label: "Platform" },
  { label: "Plans & Support" },
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
          href="/"
          className="inline-flex items-center px-1"
          aria-label="Nexsas home"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/nexsas/automation/logo/main-logo.svg"
            alt="Nexsas"
            width={198}
            height={40}
            priority
            className="hidden h-10 w-auto lg:block"
          />
          <Image
            src="/nexsas/automation/logo/logo.svg"
            alt="Nexsas"
            width={44}
            height={44}
            priority
            className="h-11 w-11 lg:hidden"
          />
        </Link>

        <nav className="hidden items-center xl:flex" aria-label="Main">
          <ul className="flex items-center">
            {NAV.map((item) => (
              <li key={item.label} className="relative py-2.5">
                <span className="flex cursor-default items-center gap-1 rounded-full border border-transparent px-4 py-2 text-[0.95rem] text-[rgb(26_26_28_/_0.6)]">
                  {item.label}
                  <svg
                    className="size-4 opacity-60"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden xl:block">
          <NsxBtnPrimary href={routes.register}>Get started</NsxBtnPrimary>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--nsx-secondary)] xl:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
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
              <li key={item.label}>
                <span className="block rounded-xl px-3 py-3 text-[0.95rem] font-medium text-[var(--nsx-secondary)]">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <NsxBtnPrimary href={routes.register} className="w-full justify-start">
              Get started
            </NsxBtnPrimary>
          </div>
        </div>
      ) : null}
    </header>
  );
}
