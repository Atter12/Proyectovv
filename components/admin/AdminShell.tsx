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
    <div className="admin-canvas min-h-screen lg:grid lg:grid-cols-[20.5rem_1fr]">
      <aside className="admin-sidebar hidden px-5 py-5 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <div className="admin-sidebar-shell flex min-h-[calc(100vh-2.5rem)] flex-col rounded-[1.35rem] border border-[var(--admin-border)] bg-[var(--admin-sidebar-panel)] p-3 shadow-[var(--admin-sidebar-shadow)]">
          <Link href="/admin/overview" className="admin-brand group mb-3 flex items-center gap-3 rounded-[1.05rem] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2.5 transition duration-200 hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/60">
            <span className="grid h-10 w-10 place-items-center rounded-[0.9rem] bg-[var(--admin-accent)] text-base font-black text-[#082131] shadow-[0_10px_22px_rgba(0,0,0,0.18)] transition duration-200 group-hover:scale-[1.02]">VV</span>
            <span className="min-w-0">
              <span className="block truncate text-[0.98rem] font-black tracking-[-0.03em] text-[var(--admin-text)]">Proyectovv</span>
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.20em] text-[var(--admin-text-muted)]">Admin console</span>
            </span>
          </Link>

          <div className="admin-health-strip mb-4 flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[0.58rem] font-black uppercase tracking-[0.20em] text-[var(--admin-info)]">Estado operativo</p>
              <p className="mt-0.5 truncate text-sm font-black text-[var(--admin-text)]">Sistema estable</p>
            </div>
            <div className="flex items-center gap-2 text-[0.62rem] font-black uppercase tracking-[0.10em] text-[var(--admin-text-muted)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" />
              Live
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <AdminNavLinks />
          </div>

          <div className="admin-quick-card mt-4 rounded-[1rem] border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-3">
            <p className="text-[0.6rem] font-black uppercase tracking-[0.20em] text-[var(--admin-text-muted)]">Acción rápida</p>
            <Link href="/admin/payments" className="mt-2 flex items-center justify-between rounded-[0.85rem] bg-[var(--admin-accent)] px-3 py-2 text-sm font-black text-[#082131] transition duration-200 hover:bg-[#7ed9be] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/70">
              Revisar pagos
              <span aria-hidden>↗</span>
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
                className="hidden rounded-2xl border border-[#cfe1e9] bg-white px-3 py-2 text-xs font-black text-[#16445a] transition hover:border-[#74d3b4] hover:bg-[#f2fff8] sm:inline-flex"
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
