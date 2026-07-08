import type { ReactNode } from "react";
import Link from "next/link";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks.client";
import { signOutAction } from "@/app/actions/auth";
import type { AdminSession } from "@/lib/admin/auth";
import { serverEnv } from "@/lib/env/env.server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminMotionFrame } from "@/components/admin/AdminMotionFrame.client";

export function AdminShell({ admin, children }: { admin: AdminSession; children: ReactNode }) {
  return (
    <AdminMotionFrame>
      <div className="admin-canvas admin-perspective-layout min-h-screen lg:grid lg:grid-cols-[24rem_minmax(0,1fr)]">
      <aside className="admin-sidebar admin-sidebar-3d hidden px-5 py-5 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-visible">
        <div className="admin-sidebar-shell flex min-h-[calc(100vh-2.5rem)] flex-col rounded-[1.45rem] bg-[var(--admin-sidebar-panel)] p-4 shadow-[var(--admin-sidebar-shadow)]">
          <section className="admin-identity-panel mb-5 rounded-[1.25rem] bg-[var(--admin-surface-soft)] p-4">
            <Link href="/admin/overview" className="admin-brand group flex items-center gap-3 rounded-[1rem] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/55">
              <span className="grid h-11 w-11 place-items-center rounded-[0.95rem] bg-[var(--admin-accent)] text-base font-black text-[#082131] shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition duration-200 group-hover:scale-[1.025]">VV</span>
              <span className="min-w-0">
                <span className="block truncate text-[1rem] font-black tracking-[-0.035em] text-[var(--admin-text)]">Proyectovv</span>
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.24em] text-[var(--admin-text-muted)]">Admin console</span>
              </span>
            </Link>

            <div className="my-3 h-px bg-[var(--admin-divider)]" />

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.58rem] font-black uppercase tracking-[0.22em] text-[var(--admin-info)]">Estado operativo</p>
                <p className="mt-1 truncate text-sm font-black text-[var(--admin-text)]">Sistema estable</p>
              </div>
              <div className="admin-live-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--admin-text-muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" />
                Live
              </div>
            </div>
          </section>

          <div className="admin-nav-scroll min-h-0 flex-1 overflow-y-auto pr-1 pb-4">
            <AdminNavLinks />
          </div>

          <div className="admin-quick-row mt-3 shrink-0 rounded-[1rem] px-2 py-2">
            <Link href="/admin/payments" className="group flex items-center justify-between rounded-[0.9rem] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--admin-text-muted)] transition duration-200 hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/50">
              Revisar pagos
              <span className="text-[var(--admin-accent)] transition group-hover:translate-x-0.5" aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </aside>

      <main className="admin-content-plane min-w-0">
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
    </AdminMotionFrame>
  );
}
