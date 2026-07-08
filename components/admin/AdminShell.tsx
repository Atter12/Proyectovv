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
        <Link href="/admin/overview" className="mb-7 flex items-center gap-3 rounded-[1.35rem] px-2 py-2">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#9af7c9,#e5fff2)] text-lg font-black text-[#063048] shadow-xl shadow-[#9af7c9]/20">VV</span>
          <span>
            <span className="block text-base font-black tracking-tight text-white">Proyectovv</span>
            <span className="block text-[0.68rem] font-black uppercase tracking-[0.22em] text-[#9af7c9]">Admin console</span>
          </span>
        </Link>
        <AdminNavLinks />
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
