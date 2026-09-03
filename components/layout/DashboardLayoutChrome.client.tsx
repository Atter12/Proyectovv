"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DashboardMobileSidebar } from "./DashboardMobileSidebar.client";
import { DashboardTopbar } from "./DashboardTopbar";
import { cn } from "@/lib/cn";
import type { User } from "@/types/user";
import type { SidebarSelectedCliente } from "./SidebarWalletCard.client";
import type { DashboardPersona } from "@/types/dashboard-persona";
import { ActingAsClienteBanner } from "./ActingAsClienteBanner.client";

const FloatingSupportStack = dynamic(
  () =>
    import("@/components/floating/FloatingSupportStack.client").then(
      (m) => m.FloatingSupportStack,
    ),
  { ssr: false },
);

interface DashboardLayoutChromeProps {
  children: React.ReactNode;
  user: User;
  selectedCliente?: SidebarSelectedCliente | null;
  persona?: DashboardPersona;
  actingAsCliente?: boolean;
}

export function DashboardLayoutChrome({
  children,
  user,
  selectedCliente = null,
  persona = "cliente",
  actingAsCliente = false,
}: DashboardLayoutChromeProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
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
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[rgb(28_25_23_/_0.35)] backdrop-blur-sm lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        id="dashboard-mobile-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(300px,90vw)] transition-transform duration-200 ease-out lg:hidden",
          sidebarOpen
            ? "translate-x-0 pointer-events-auto"
            : "-translate-x-full pointer-events-none",
        )}
        role="dialog"
        aria-modal={sidebarOpen}
        aria-hidden={!sidebarOpen}
        aria-label="Menú de navegación"
      >
        <div className="relative h-full overflow-hidden rounded-r-[1.25rem] border-r border-[var(--auth-border)] shadow-[8px_0_40px_-12px_rgb(28_25_23_/_0.28)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
            className="absolute right-2.5 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--auth-text-muted)] transition-colors hover:bg-[var(--auth-bg)] hover:text-[var(--auth-text)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <DashboardMobileSidebar
            onNavigate={() => setSidebarOpen(false)}
            className="h-full w-full"
            selectedCliente={selectedCliente}
            persona={persona}
            actingAsCliente={actingAsCliente}
          />
        </div>
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[248px]">
        <DashboardTopbar
          user={user}
          sidebarOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
          selectedCliente={selectedCliente}
          persona={persona}
          actingAsCliente={actingAsCliente}
        />
        <main className="app-content mx-auto min-w-0 w-full max-w-[1280px] flex-1 px-4 py-5 pb-20 sm:px-5 sm:pb-24 md:py-6 md:pb-16 lg:pb-8">
          {actingAsCliente && selectedCliente ? (
            <ActingAsClienteBanner clienteName={selectedCliente.name} />
          ) : null}
          {children}
        </main>
      </div>

      <FloatingSupportStack persona={persona} />
    </>
  );
}
