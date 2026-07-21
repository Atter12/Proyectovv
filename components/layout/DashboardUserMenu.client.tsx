"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { apiClient } from "@/lib/api/api-client.client";
import { cn } from "@/lib/cn";
import type { User } from "@/types/user";

interface LogoutResponse {
  ok: boolean;
  redirectTo: string;
}

interface DashboardUserMenuProps {
  user: User;
}

export function DashboardUserMenu({ user }: DashboardUserMenuProps) {
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
          "flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-white/80 py-1.5 pl-1.5 pr-2.5 shadow-sm transition-all",
          "hover:border-[var(--brand-primary)]/25 hover:bg-white hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/30",
          open && "border-[var(--brand-primary)]/30 bg-white shadow-md",
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--brand-primary)] text-[12px] font-bold text-white shadow-[0_6px_14px_rgb(23_139_255_/_0.28)]">
          {user.avatarInitials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[140px] truncate text-[13px] font-semibold tracking-tight text-[var(--foreground)] xl:max-w-[180px]">
            {user.name}
          </span>
          <span className="block max-w-[140px] truncate text-[11px] text-[var(--admin-text-muted,#64748b)] xl:max-w-[180px]">
            {user.email}
          </span>
        </span>
        <svg
          className={cn(
            "hidden h-4 w-4 text-[var(--admin-text-muted,#64748b)] transition-transform sm:block",
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
          className="absolute right-0 z-40 mt-2 w-[260px] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white p-1.5 shadow-[0_18px_40px_rgb(15_23_42_/_0.12)]"
        >
          <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-3">
            <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
              {user.name}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-[var(--admin-text-muted,#64748b)]">
              {user.email}
            </p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-[#b42318] transition-colors hover:bg-red-50 disabled:opacity-55"
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
