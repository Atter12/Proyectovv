import Link from "next/link";
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
        className="admin-brand flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-out hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#178BFF]/30"
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#178BFF] text-sm font-bold tracking-tight text-white shadow-sm"
          aria-hidden
        >
          VV
        </span>

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold leading-tight tracking-tight text-slate-900">
            {siteConfig.name}
          </span>
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-slate-400">Admin</span>
        </span>
      </Link>

      <div className="admin-brand-divider mt-3" aria-hidden />
    </div>
  );
}
