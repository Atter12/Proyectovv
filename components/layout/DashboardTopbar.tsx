"use client";

import { usePathname } from "next/navigation";
import { mainNavigation } from "@/config/navigation";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown.client";
import { DashboardUserMenu } from "@/components/layout/DashboardUserMenu.client";
import type { User } from "@/types/user";

interface DashboardTopbarProps {
  user: User;
  sidebarOpen?: boolean;
  onMenuClick?: () => void;
}

export function DashboardTopbar({
  user,
  sidebarOpen = false,
  onMenuClick,
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const currentPage = mainNavigation.find((item) => item.href === pathname);
  const pageTitle = currentPage?.label ?? "Panel";

  return (
    <header className="dashboard-glass sticky top-0 z-20 flex h-16 min-h-[64px] items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 shadow-[var(--shadow-topbar)] sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú de navegación"
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--admin-text-muted,#64748b)] transition-colors hover:bg-white hover:text-[var(--foreground)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/35 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
            Ecomdy
          </p>
          <h1 className="truncate font-display text-[1.15rem] font-medium tracking-[-0.02em] text-[var(--foreground)] sm:text-[1.25rem]">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <NotificationsDropdown />
        <DashboardUserMenu user={user} />
      </div>
    </header>
  );
}
