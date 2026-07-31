"use client";

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

interface DashboardMobileSidebarProps {
  onNavigate: () => void;
  className?: string;
  selectedCliente?: SidebarSelectedCliente | null;
}

export function DashboardMobileSidebar({
  onNavigate,
  className,
  selectedCliente = null,
}: DashboardMobileSidebarProps) {
  return (
    <aside
      className={cn("dashboard-rail flex h-full shrink-0 flex-col", className)}
    >
      <div className="border-b border-[var(--auth-divider)] px-4 py-4 pt-14">
        <Link
          href={routes.overview}
          prefetch
          onClick={onNavigate}
          className="mx-auto flex w-full max-w-full items-center justify-center"
          aria-label={siteConfig.name}
        >
          <HolisticLogo
            size={140}
            className="mx-auto h-10 w-auto max-w-[85%]"
          />
        </Link>

        <SidebarWalletCard
          onNavigate={onNavigate}
          selectedCliente={selectedCliente}
        />
      </div>

      <div className="px-3 pt-4">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
          Menú
        </p>
      </div>

      <DashboardNavLinks onNavigate={onNavigate} />
    </aside>
  );
}
