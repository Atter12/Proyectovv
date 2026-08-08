"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DashboardMobileSidebar } from "./DashboardMobileSidebar.client";
import { DashboardTopbar } from "./DashboardTopbar";
import { cn } from "@/lib/cn";
import type { User } from "@/types/user";
import type { SidebarSelectedCliente } from "./SidebarWalletCard.client";
import type { DashboardPersona } from "@/types/dashboard-persona";

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
}

export function DashboardLayoutChrome({
  children,
  user,
  selectedCliente = null,
  persona = "cliente",
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
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(288px,88vw)] transition-transform duration-200 ease-out lg:hidden",
          sidebarOpen
            ? "translate-x-0 pointer-events-auto"
            : "-translate-x-full pointer-events-none",
        )}
        role="dialog"
        aria-modal={sidebarOpen}
        aria-hidden={!sidebarOpen}
      >
        <div className="relative h-full shadow-2xl">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
            className="absolute right-2 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--auth-text-muted)] transition-colors hover:bg-[var(--auth-bg)] hover:text-[var(--auth-text)]"
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
          />
        </div>
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[272px]">
        <DashboardTopbar
          user={user}
          sidebarOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
          selectedCliente={selectedCliente}
          persona={persona}
        />
        <main className="mx-auto min-w-0 w-full max-w-[1480px] flex-1 px-4 py-5 pb-24 sm:px-5 md:px-6 md:py-6 md:pb-16 lg:pb-8 xl:px-8">
          {children}
        </main>
      </div>

      <FloatingSupportStack />
    </>
  );
}
