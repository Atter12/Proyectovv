"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { apiClient } from "@/lib/api/api-client.client";
import { cn } from "@/lib/cn";
import type { User } from "@/types/user";
import {
  dashboardPersonaLabel,
  type DashboardPersona,
} from "@/types/dashboard-persona";

interface LogoutResponse {
  ok: boolean;
  redirectTo: string;
}

interface DashboardUserMenuProps {
  user: User;
  persona?: DashboardPersona;
}

export function DashboardUserMenu({
  user,
  persona = "cliente",
}: DashboardUserMenuProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2.5 rounded-lg border border-[var(--auth-border)] bg-white py-1.5 pl-1.5 pr-2.5 transition-all",
          "hover:border-[var(--auth-accent)]/30 hover:bg-[var(--auth-bg)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/30",
          open && "border-[var(--auth-accent)]/35 bg-[var(--auth-bg)]",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--auth-accent)] text-[11px] font-bold text-white">
          {user.avatarInitials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[130px] truncate text-[13px] font-semibold tracking-tight text-[var(--auth-text)] xl:max-w-[160px]">
            {user.name}
          </span>
          <span className="block max-w-[130px] truncate text-[11px] text-[var(--auth-text-soft)] xl:max-w-[160px]">
            {persona === "cliente" ? user.email : dashboardPersonaLabel(persona)}
          </span>
        </span>
        <svg
          className={cn(
            "hidden h-4 w-4 text-[var(--auth-text-soft)] transition-transform sm:block",
            open && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-[260px] overflow-hidden rounded-xl border border-[var(--auth-border)] bg-white p-1.5 shadow-[0_18px_40px_rgb(28_25_23_/_0.12)]"
        >
          <div className="rounded-lg bg-[var(--auth-bg)] px-3 py-3">
            <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
              {user.name}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-[var(--auth-text-muted)]">
              {user.email}
            </p>
            {persona !== "cliente" ? (
              <p className="mt-2">
                <span className="dashboard-role-badge" data-role={persona}>
                  {dashboardPersonaLabel(persona)}
                </span>
              </p>
            ) : null}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-[#b42318] transition-colors hover:bg-red-50 disabled:opacity-55"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
