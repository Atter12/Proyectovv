import type { ReactNode } from "react";
import Link from "next/link";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks.client";
import { signOutAction } from "@/app/actions/auth";
import type { AdminSession } from "@/lib/admin/auth";
import { serverEnv } from "@/lib/env/env.server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export function AdminShell({ admin, children }: { admin: AdminSession; children: ReactNode }) {
  return (
    <div className="admin-canvas min-h-screen lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="admin-sidebar hidden px-4 py-5 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <div className="admin-sidebar-inner flex min-h-[calc(100vh-2.5rem)] flex-col rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Link href="/admin/overview" className="admin-brand group mb-4 flex items-center gap-3 rounded-[1.55rem] border border-white/[0.08] bg-white/[0.055] px-3 py-3 transition hover:bg-white/[0.085]">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#9af7c9,#dffff0)] text-lg font-black text-[#063048] shadow-xl shadow-[#9af7c9]/25 transition group-hover:scale-105">VV</span>
            <span className="min-w-0">
              <span className="block truncate text-base font-black tracking-tight text-white">Proyectovv</span>
              <span className="block text-[0.68rem] font-black uppercase tracking-[0.22em] text-[#9af7c9]">Admin console</span>
            </span>
          </Link>

          <div className="mb-5 rounded-[1.35rem] border border-[#9af7c9]/18 bg-[#052334]/70 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.16)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[#8ee9ff]">Estado operativo</p>
                <p className="mt-1 text-sm font-black text-white">Sistema estable</p>
              </div>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9af7c9] opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#9af7c9]" />
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/[0.055] px-2 py-2">
                <p className="text-xs font-black text-white">99%</p>
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#78aabc]">Uptime</p>
              </div>
              <div className="rounded-2xl bg-white/[0.055] px-2 py-2">
                <p className="text-xs font-black text-white">24h</p>
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#78aabc]">SLA</p>
              </div>
              <div className="rounded-2xl bg-white/[0.055] px-2 py-2">
                <p className="text-xs font-black text-white">Live</p>
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#78aabc]">Audit</p>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <AdminNavLinks />
          </div>

          <div className="mt-5 rounded-[1.45rem] border border-[#8ee9ff]/15 bg-[linear-gradient(135deg,rgba(142,233,255,0.09),rgba(154,247,201,0.10))] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[#8ee9ff]">Acción rápida</p>
            <Link href="/admin/payments" className="mt-2 flex items-center justify-between rounded-2xl bg-[#9af7c9] px-3 py-2.5 text-sm font-black text-[#062235] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(154,247,201,0.22)]">
              Revisar pagos
              <span>↗</span>
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#d7e7ee]/80 bg-white/82 px-4 py-3 shadow-[var(--shadow-topbar)] backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#0e7490]">{serverEnv.appName}</p>
              <p className="truncate text-sm font-bold text-[#5d7280]">Centro de control financiero, soporte y auditoría en tiempo real</p>
            </div>
            <div className="flex items-center gap-3">
              {admin.accessMode === "development-open" ? <Badge tone="warning">Dev open</Badge> : <Badge tone="success">Allowlist</Badge>}
              <a
                href={serverEnv.customerAppUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden rounded-2xl border border-[#cfe1e9] bg-white px-3 py-2 text-xs font-black text-[#16445a] transition hover:border-[#9af7c9] hover:bg-[#f2fff8] sm:inline-flex"
              >
                App cliente ↗
              </a>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-black text-[#061925]">{admin.fullName ?? admin.email}</p>
                <p className="text-xs font-bold text-[#7b91a0]">{admin.email}</p>
              </div>
              <form action={signOutAction}>
                <Button type="submit" variant="secondary" size="sm">Salir</Button>
              </form>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-5 rounded-[1.4rem] border border-[#d7e7ee] bg-white/88 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl lg:hidden">
            <AdminNavLinks />
          </div>
          <div className="page-enter">{children}</div>
        </div>
      </main>
    </div>
  );
}
