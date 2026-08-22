import Link from "next/link";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";
import { DashboardNavLinks } from "./DashboardNavLinks.client";
import {
  SidebarWalletCard,
  type SidebarSelectedCliente,
} from "./SidebarWalletCard.client";
import {
  dashboardPersonaLabel,
  type DashboardPersona,
} from "@/types/dashboard-persona";

interface DashboardSidebarProps {
  className?: string;
  selectedCliente?: SidebarSelectedCliente | null;
  persona?: DashboardPersona;
}

export function DashboardSidebar({
  className,
  selectedCliente = null,
  persona = "cliente",
}: DashboardSidebarProps) {
  return (
    <aside
      id="dashboard-sidebar"
      className={cn("dashboard-rail flex h-full shrink-0 flex-col", className)}
    >
      <div className="border-b border-[var(--auth-divider)] px-4 pb-5 pt-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={routes.overview}
            prefetch
            className="inline-flex shrink-0 items-center"
            aria-label={siteConfig.name}
          >
            <HolisticLogo size={132} className="h-9 w-auto max-w-[140px]" />
          </Link>
          <span className="dashboard-role-badge" data-role={persona}>
            {dashboardPersonaLabel(persona)}
          </span>
        </div>

        <SidebarWalletCard
          selectedCliente={selectedCliente}
          persona={persona}
        />
      </div>

      <p className="dashboard-sidebar-menu-label">Menú</p>

      <DashboardNavLinks persona={persona} />
    </aside>
  );
}
