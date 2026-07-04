"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DashboardMobileSidebar } from "./DashboardMobileSidebar.client";
import { DashboardTopbar } from "./DashboardTopbar";
import { cn } from "@/lib/cn";
import type { User } from "@/types/user";

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
}

export function DashboardLayoutChrome({
  children,
  user,
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
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] transition-transform duration-200 ease-out lg:hidden",
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
            className="absolute right-2 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#64748b] transition-colors hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <DashboardMobileSidebar
            onNavigate={() => setSidebarOpen(false)}
            className="h-full w-full"
          />
        </div>
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <DashboardTopbar
          user={user}
          sidebarOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="mx-auto min-w-0 w-full max-w-[1600px] flex-1 px-4 py-4 pb-32 sm:px-5 md:px-6 md:py-6 md:pb-28 lg:pb-8 xl:px-8">
          {children}
        </main>
      </div>

      <FloatingSupportStack />
    </>
  );
}
