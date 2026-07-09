"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AdminSidebarPanel } from "@/components/admin/AdminSidebarPanel";
import { routes } from "@/config/routes";
import type { AdminSession } from "@/lib/admin/auth";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

type AdminShellChromeProps = {
  admin: AdminSession;
  appName: string;
  children: ReactNode;
};

export function AdminShellChrome({ admin, appName, children }: AdminShellChromeProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSidebarOpen(false);
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#061925]/55 backdrop-blur-sm lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div
        id="admin-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(17rem,88vw)] transition-transform duration-200 ease-out lg:hidden",
          sidebarOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        role="dialog"
        aria-modal={sidebarOpen}
        aria-hidden={!sidebarOpen}
        aria-label="Menú de navegación admin"
      >
        <aside className="admin-sidebar admin-sidebar-operational admin-mobile-sidebar relative h-full overflow-hidden px-3 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
            className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--admin-text-muted)] transition-colors hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="h-full pt-10">
            <AdminSidebarPanel admin={admin} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </aside>
      </div>

      <div className="admin-canvas admin-perspective-layout admin-perspective-layout--operational min-h-screen lg:grid lg:h-screen lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="admin-sidebar admin-sidebar-operational hidden border-r border-[var(--admin-border)] px-3 py-3 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-hidden">
          <AdminSidebarPanel admin={admin} />
        </aside>

        <main className="admin-content-plane min-w-0 lg:h-screen lg:overflow-y-auto">
          <header className="admin-topbar sticky top-0 z-30 border-b border-[#d7e7ee]/70 bg-white/[0.78] px-4 py-3 shadow-[var(--shadow-topbar)] backdrop-blur-2xl sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-3 sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Abrir menú de navegación"
                  aria-expanded={sidebarOpen}
                  aria-controls="admin-sidebar"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#cfe1e9] bg-white/80 text-[#16445a] shadow-sm transition hover:border-[#74d3b4] hover:bg-[#f2fff8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/50 lg:hidden"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#0e7490]">{appName}</p>
                  <p className="truncate text-sm font-bold text-[#5d7280]">Centro de control financiero, soporte y auditoría en tiempo real</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {admin.accessMode === "development-open" ? <Badge tone="warning">Dev open</Badge> : <Badge tone="success">Allowlist</Badge>}
                <Link
                  href={routes.overview}
                  className="hidden rounded-full border border-[#cfe1e9] bg-white/75 px-3 py-2 text-xs font-black text-[#16445a] shadow-sm transition hover:border-[#74d3b4] hover:bg-[#f2fff8] sm:inline-flex"
                >
                  Panel cliente
                </Link>
              </div>
            </div>
          </header>
          <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8 xl:py-7">
            <div className="page-enter">{children}</div>
          </div>
        </main>
      </div>
    </>
  );
}
