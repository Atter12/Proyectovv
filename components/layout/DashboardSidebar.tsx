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
        "flex h-full shrink-0 flex-col border-r border-[#e5e7eb] bg-white",
        className,
      )}
    >
      <div className="border-b border-[#e5e7eb] px-4 py-4">
        <Link
          href={routes.overview}
          prefetch
          className="flex min-w-0 items-center gap-2.5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-xs font-bold text-white shadow-sm shadow-indigo-500/20">
            DM
          </div>
          <span className="truncate text-sm font-bold tracking-tight text-[#0f172a]">
            {siteConfig.name}
          </span>
        </Link>

        <SidebarWalletCard />
      </div>

      <DashboardNavLinks />
    </aside>
  );
}
