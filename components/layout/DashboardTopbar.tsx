"use client";

import { usePathname } from "next/navigation";
import { mainNavigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
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
  const currentPage = mainNavigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const pageTitle = currentPage?.label ?? "Panel";

  return (
    <header className="dashboard-glass sticky top-0 z-20 flex h-16 min-h-[64px] items-center justify-between gap-3 border-b border-[var(--panel-line,rgb(15_23_42_/_0.08))] px-4 sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú de navegación"
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--panel-ink-soft,#475569)] transition-colors hover:bg-[var(--auth-accent-soft,#fff1e8)] hover:text-[var(--panel-ink,#0f172a)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/35 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--brand-primary)]">
            {siteConfig.name}
          </p>
          <h1 className="truncate text-[1.35rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--panel-ink,#0f172a)] sm:text-[1.45rem]">
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
