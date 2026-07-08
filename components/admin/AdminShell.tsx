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
    <div className="admin-canvas admin-perspective-layout admin-perspective-layout--operational min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="admin-sidebar admin-sidebar-operational hidden border-r border-[var(--admin-border)] px-3 py-3 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <div className="admin-sidebar-shell flex min-h-full flex-col">
          <Link
            href="/admin/overview"
            className="admin-brand mb-3 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/50"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--admin-accent)] text-xs font-black text-[#082131]">VV</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[var(--admin-text)]">Proyectovv</span>
              <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--admin-text-muted)]">Admin</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--admin-border)] px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-[var(--admin-text-soft)]" title="Sistema estable">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" aria-hidden />
              Live
            </span>
          </Link>

          <div className="admin-nav-scroll min-h-0 flex-1 overflow-y-auto pb-2">
            <AdminNavLinks />
          </div>

          <div className="admin-quick-row mt-2 shrink-0 border-t border-[var(--admin-divider)] pt-2">
            <Link
              href="/admin/payments"
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--admin-text-muted)] transition-colors duration-150 hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/50"
            >
              Revisar pagos
              <span className="text-[var(--admin-accent)]" aria-hidden>→</span>
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
          <div className="mb-5 rounded-xl border border-[#d7e7ee] bg-white p-3 shadow-[var(--shadow-card)] lg:hidden">
            <AdminNavLinks />
          </div>
          <div className="page-enter">{children}</div>
        </div>
      </main>
    </div>
  );
}
