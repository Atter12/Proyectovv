"use client";

import { useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar.client";
import { DashboardTopbar } from "./DashboardTopbar";
import { FloatingSupportButtons } from "@/components/floating/FloatingSupportButtons.client";
import { userMock } from "@/mocks/user.mock";
import { cn } from "@/lib/cn";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <DashboardSidebar className="fixed inset-y-0 left-0 z-30" />
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <DashboardSidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <DashboardTopbar
          user={userMock}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      <FloatingSupportButtons />
    </div>
  );
}
