import Link from "next/link";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks.client";

type AdminSidebarPanelProps = {
  onNavigate?: () => void;
};

export function AdminSidebarPanel({ onNavigate }: AdminSidebarPanelProps) {
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
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--admin-border)] px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-[var(--admin-text-soft)]" title="Sistema estable">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" aria-hidden />
          Live
        </span>
      </Link>

      <div className="admin-nav-scroll min-h-0 flex-1 overflow-y-auto pb-2">
        <AdminNavLinks onNavigate={onNavigate} />
      </div>

      <div className="admin-quick-row mt-2 shrink-0 border-t border-[var(--admin-divider)] pt-2">
        <Link
          href="/admin/payments"
          onClick={onNavigate}
          className="flex items-center justify-between rounded-md px-2 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--admin-text-muted)] transition-colors duration-150 hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/50"
        >
          Revisar pagos
          <span className="text-[var(--admin-accent)]" aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
