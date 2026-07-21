import Link from "next/link";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { EcomdyLogo } from "@/components/brand/EcomdyLogo";
import { DashboardNavLinks } from "./DashboardNavLinks.client";
import { SidebarWalletCard } from "./SidebarWalletCard.client";

interface DashboardSidebarProps {
  className?: string;
}

export function DashboardSidebar({ className }: DashboardSidebarProps) {
  return (
    <aside
      id="dashboard-sidebar"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[var(--border-subtle)] bg-white/95 shadow-[8px_0_28px_rgb(15_23_42_/_0.04)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="border-b border-[var(--border-subtle)] px-4 py-4">
        <Link
          href={routes.overview}
          prefetch
          className="flex min-w-0 items-center gap-3"
        >
          <EcomdyLogo size={40} className="shadow-[0_8px_18px_rgb(23_139_255_/_0.22)]" />
          <span className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            {siteConfig.name}
          </span>
        </Link>

        <SidebarWalletCard />
      </div>

      <div className="px-3 pt-4">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-soft,#94a3b8)]">
          Menú
        </p>
      </div>

      <DashboardNavLinks />
    </aside>
  );
}
