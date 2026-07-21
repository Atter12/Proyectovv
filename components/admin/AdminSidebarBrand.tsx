import Link from "next/link";
import { EcomdyLogo } from "@/components/brand/EcomdyLogo";
import { siteConfig } from "@/config/site";

type AdminSidebarBrandProps = {
  onNavigate?: () => void;
};

export function AdminSidebarBrand({ onNavigate }: AdminSidebarBrandProps) {
  return (
    <div className="admin-brand-block shrink-0 px-1 pb-2 pt-1">
      <Link
        href="/admin/overview"
        onClick={onNavigate}
        className="admin-brand flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-out hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/30"
      >
        <EcomdyLogo size={36} className="shadow-sm" />

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold leading-tight tracking-tight text-[var(--admin-text)]">
            {siteConfig.name}
          </span>
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-[var(--admin-text-soft)]">
            Admin
          </span>
        </span>
      </Link>

      <div className="admin-brand-divider mt-3" aria-hidden />
    </div>
  );
}
