import Link from "next/link";
import { siteConfig } from "@/config/site";

type AdminSidebarBrandProps = {
  onNavigate?: () => void;
};

export function AdminSidebarBrand({ onNavigate }: AdminSidebarBrandProps) {
  return (
    <Link
      href="/admin/overview"
      onClick={onNavigate}
      className="admin-brand mb-5 flex w-full flex-col items-center gap-2.5 rounded-xl px-3 pb-4 pt-3.5 text-center transition-colors duration-150 hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/50"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--admin-accent)] text-sm font-black tracking-tight text-[#082131] ring-1 ring-white/10"
        aria-hidden
      >
        VV
      </span>

      <span className="flex w-full min-w-0 flex-col items-center gap-1">
        <span className="max-w-full truncate text-base font-semibold leading-tight tracking-tight text-[var(--admin-text)]">
          {siteConfig.name}
        </span>
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-[var(--admin-text-muted)]">
          Admin
        </span>
      </span>
    </Link>
  );
}
