import Link from "next/link";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
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
        "flex h-full shrink-0 flex-col border-r border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.86))] shadow-[8px_0_36px_rgb(15_23_42_/_0.05)] backdrop-blur-2xl",
        className,
      )}
    >
      <div className="border-b border-[var(--border-subtle)] px-4 py-4">
        <Link
          href={routes.overview}
          prefetch
          className="flex min-w-0 items-center gap-2.5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4056ff] via-[#6d5df8] to-[#7c3aed] text-xs font-bold text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/70">
            DM
          </div>
          <span className="truncate text-sm font-black tracking-[-0.02em] text-[#0f172a]">
            {siteConfig.name}
          </span>
        </Link>

        <SidebarWalletCard />
      </div>

      <DashboardNavLinks />
    </aside>
  );
}
