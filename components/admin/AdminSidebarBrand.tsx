import Link from "next/link";
import { siteConfig } from "@/config/site";

type AdminSidebarBrandProps = {
  onNavigate?: () => void;
};

export function AdminSidebarBrand({ onNavigate }: AdminSidebarBrandProps) {
  return (
    <div className="admin-brand-block shrink-0">
      <Link
        href="/admin/overview"
        onClick={onNavigate}
        className="admin-brand flex w-full flex-col items-center gap-2 rounded-xl px-2 pb-2.5 pt-2 text-center transition-colors duration-200 ease-out hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45"
      >
        <span
          className="admin-brand-logo grid h-9 w-9 shrink-0 place-items-center rounded-[0.65rem] bg-gradient-to-br from-[#74d3b4] to-[#5bc4a3] text-sm font-bold tracking-tight text-[#062235] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_4px_16px_rgba(116,211,180,0.16)] ring-1 ring-white/8"
          aria-hidden
        >
          VV
        </span>

        <span className="flex w-full min-w-0 flex-col items-center gap-0.5">
          <span className="max-w-full truncate text-[0.9375rem] font-semibold leading-tight tracking-tight text-[var(--admin-text)]">
            {siteConfig.name}
          </span>
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-[#9dd5e3]/85">
            Admin
          </span>
        </span>
      </Link>

      <div className="admin-brand-divider mt-3" aria-hidden />
    </div>
  );
}
