"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { mainNavigation } from "@/config/navigation";
import { routes } from "@/config/routes";
import { apiClient } from "@/lib/api/api-client.client";
import type { User } from "@/types/user";

interface DashboardTopbarProps {
  user: User;
  sidebarOpen?: boolean;
  onMenuClick?: () => void;
}

interface LogoutResponse {
  ok: boolean;
  redirectTo: string;
}

export function DashboardTopbar({
  user,
  sidebarOpen = false,
  onMenuClick,
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const currentPage = mainNavigation.find((item) => item.href === pathname);
  const pageTitle = currentPage?.label ?? "Panel";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const data = await apiClient<LogoutResponse>(routes.api.auth.logout, {
        method: "POST",
      });
      router.push(data.redirectTo);
      router.refresh();
    } catch {
      router.push(routes.login);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="dashboard-glass sticky top-0 z-20 flex h-14 min-h-[56px] items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 shadow-[var(--shadow-topbar)] sm:h-16 sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú de navegación"
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#64748b] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold tracking-tight text-[#0f172a] sm:text-base md:text-lg">
            {pageTitle}
          </h1>
          <p className="hidden truncate text-xs text-[#64748b] sm:block sm:text-sm">
            Bienvenido de nuevo, {user.name}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
        <button
          type="button"
          className="hidden h-10 w-10 items-center justify-center rounded-xl text-[#64748b] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40 md:inline-flex"
          aria-label="Notificaciones"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </button>
        <button
          type="button"
          className="hidden h-10 w-10 items-center justify-center rounded-xl text-[#64748b] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40 lg:inline-flex"
          aria-label="Ayuda"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </button>
        <div className="hidden max-w-[180px] text-right lg:block xl:max-w-[220px]">
          <p className="truncate text-xs text-[#64748b]">{user.email}</p>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-xs font-semibold text-white ring-2 ring-white sm:h-10 sm:w-10"
          aria-hidden
        >
          {user.avatarInitials}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Cerrar sesión"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e7eb] text-[#64748b] transition-colors hover:bg-slate-50 hover:text-[#0f172a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40 disabled:opacity-50 sm:h-auto sm:w-auto sm:px-3 sm:text-xs sm:font-medium"
        >
          <span className="hidden sm:inline">{loggingOut ? "Saliendo…" : "Salir"}</span>
          <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </header>
  );
}
