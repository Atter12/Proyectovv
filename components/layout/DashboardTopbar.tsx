"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNavigation } from "@/config/navigation";
import { routes } from "@/config/routes";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown.client";
import { DashboardUserMenu } from "@/components/layout/DashboardUserMenu.client";
import type { User } from "@/types/user";
import type { SidebarSelectedCliente } from "./SidebarWalletCard.client";
import type { DashboardPersona } from "@/types/dashboard-persona";

interface DashboardTopbarProps {
  user: User;
  sidebarOpen?: boolean;
  onMenuClick?: () => void;
  selectedCliente?: SidebarSelectedCliente | null;
  persona?: DashboardPersona;
}

export function DashboardTopbar({
  user,
  sidebarOpen = false,
  onMenuClick,
  selectedCliente = null,
  persona = "cliente",
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const currentPage = mainNavigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const pageTitle =
    currentPage?.href === "/overview"
      ? "Resumen"
      : currentPage?.href === "/ad-accounts"
        ? "Cuentas ads"
        : currentPage?.href === "/payments"
          ? "Pagos"
          : currentPage?.href === "/clientes"
            ? "Clientes"
            : currentPage?.href === "/affiliates"
              ? "Afiliados"
              : currentPage?.href === "/creative-analyzer"
                ? "Creativos"
                : currentPage?.href === "/support"
                  ? persona === "cliente"
                    ? "Soporte"
                    : "Inbox Soporte"
                  : (currentPage?.label ?? "Panel");

  const canPickClients = persona !== "cliente";

  return (
    <header className="app-topbar sticky top-0 z-20 flex h-14 min-h-[56px] items-center justify-between gap-2 px-3.5 sm:h-16 sm:min-h-[64px] sm:gap-3 sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú de navegación"
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-mobile-sidebar"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--auth-border)] bg-white text-[var(--auth-text-muted)] transition-colors hover:bg-[var(--auth-bg)] hover:text-[var(--auth-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-[1rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.15rem]">
            {pageTitle}
          </h1>
          {selectedCliente ? (
            <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--auth-text-muted)] sm:text-[12px]">
              {canPickClients ? (
                <span className="hidden sm:inline">Cliente: </span>
              ) : null}
              <span className="font-semibold text-[var(--auth-text)]">
                {selectedCliente.name}
              </span>
              {canPickClients ? (
                <>
                  {" · "}
                  <Link
                    href={routes.clientes}
                    className="font-semibold text-[var(--auth-accent)] hover:underline"
                  >
                    cambiar
                  </Link>
                </>
              ) : null}
            </p>
          ) : canPickClients ? (
            <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--auth-text-soft)] sm:text-[12px]">
              Sin cliente ·{" "}
              <Link
                href={routes.clientes}
                className="font-semibold text-[var(--auth-accent)] hover:underline"
              >
                elegir
              </Link>
            </p>
          ) : (
            <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--auth-text-soft)] sm:text-[12px]">
              Recargá con Stripe y asigná a tus ads
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <NotificationsDropdown />
        <DashboardUserMenu user={user} persona={persona} />
      </div>
    </header>
  );
}
