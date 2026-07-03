"use client";

import type { User } from "@/types/user";

interface DashboardTopbarProps {
  user: User;
  onMenuClick?: () => void;
}

export function DashboardTopbar({ user, onMenuClick }: DashboardTopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Abrir menú"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="hidden sm:block">
          <p className="text-xs text-slate-500">Bienvenido de nuevo</p>
          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          {user.avatarInitials}
        </div>
      </div>
    </header>
  );
}
