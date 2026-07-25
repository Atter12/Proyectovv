import Link from "next/link";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";
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
        aria-label={siteConfig.name}
        className="admin-brand flex w-full items-center justify-center rounded-lg px-2 py-2 transition-colors duration-150 ease-out hover:bg-[var(--admin-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/30"
      >
        <HolisticLogo
          size={140}
          className="h-9 w-auto max-w-[85%] object-contain"
        />
      </Link>

      <div className="admin-brand-divider mt-3" aria-hidden />
    </div>
  );
}
