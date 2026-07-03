"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar.client";
import { DashboardTopbar } from "./DashboardTopbar";
import { cn } from "@/lib/cn";
import type { User } from "@/types/user";
import type { Wallet } from "@/types/wallet";

const FloatingSupportStack = dynamic(
  () =>
    import("@/components/floating/FloatingSupportStack.client").then(
      (m) => m.FloatingSupportStack,
    ),
  { ssr: false },
);

interface DashboardShellProps {
  children: React.ReactNode;
  user: User;
  wallet: Wallet;
}

export function DashboardShell({ children, user, wallet }: DashboardShellProps) {
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
    <div className="flex min-h-screen overflow-x-hidden bg-[#f5f7fb]">
      <div className="hidden lg:block">
        <DashboardSidebar
          wallet={wallet}
          className="fixed inset-y-0 left-0 z-30 h-full w-64"
        />
      </div>

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
        <DashboardSidebar
          wallet={wallet}
          onNavigate={() => setSidebarOpen(false)}
          onClose={() => setSidebarOpen(false)}
          isMobileDrawer
          className="h-full w-full shadow-2xl"
        />
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
    </div>
  );
}
