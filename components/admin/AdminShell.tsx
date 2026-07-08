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
    <div className="min-h-screen lg:grid lg:grid-cols-[19rem_1fr]">
      <aside className="hidden border-r border-white/70 bg-white/70 px-4 py-5 shadow-[var(--shadow-topbar)] backdrop-blur-xl lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <Link href="/admin/overview" className="mb-7 flex items-center gap-3 rounded-[1.4rem] px-2 py-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-lg shadow-slate-950/15">VV</span>
          <span>
            <span className="block text-base font-black tracking-tight text-slate-950">Proyectovv</span>
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Admin console</span>
          </span>
        </Link>
        <AdminNavLinks />
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 px-4 py-3 shadow-[var(--shadow-topbar)] backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">{serverEnv.appName}</p>
              <p className="truncate text-sm font-bold text-slate-500">Operación financiera, soporte y auditoría en tiempo real</p>
            </div>
            <div className="flex items-center gap-3">
              {admin.accessMode === "development-open" ? <Badge tone="warning">Dev open</Badge> : <Badge tone="success">Allowlist</Badge>}
              <a
                href={serverEnv.customerAppUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 sm:inline-flex"
              >
                App cliente ↗
              </a>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-black text-slate-950">{admin.fullName ?? admin.email}</p>
                <p className="text-xs font-bold text-slate-400">{admin.email}</p>
              </div>
              <form action={signOutAction}>
                <Button type="submit" variant="secondary" size="sm">Salir</Button>
              </form>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-5 rounded-[1.7rem] border border-white/70 bg-white/75 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl lg:hidden">
            <AdminNavLinks />
          </div>
          <div className="page-enter">{children}</div>
        </div>
      </main>
    </div>
  );
}
