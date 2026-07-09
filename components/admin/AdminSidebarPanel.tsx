import Link from "next/link";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks.client";
import { AdminSidebarUserSession } from "@/components/admin/AdminSidebarUserSession";
import type { AdminSession } from "@/lib/admin/auth";

type AdminSidebarPanelProps = {
  admin: AdminSession;
  onNavigate?: () => void;
};

export function AdminSidebarPanel({ admin, onNavigate }: AdminSidebarPanelProps) {
  return (
    <div className="admin-sidebar-shell flex h-full flex-col">
      <Link
        href="/admin/overview"
        onClick={onNavigate}
        className="admin-brand mb-3 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/50"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--admin-accent)] text-xs font-black text-[#082131]">VV</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[var(--admin-text)]">Proyectovv</span>
          <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--admin-text-muted)]">Admin</span>
        </span>
      </Link>

      <div className="admin-nav-scroll min-h-0 flex-1 overflow-y-auto pb-2">
        <AdminNavLinks onNavigate={onNavigate} />
      </div>

      <AdminSidebarUserSession admin={admin} />
    </div>
  );
}
