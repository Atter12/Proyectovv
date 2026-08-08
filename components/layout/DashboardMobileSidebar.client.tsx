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
import {
  dashboardPersonaLabel,
  type DashboardPersona,
} from "@/types/dashboard-persona";

interface DashboardMobileSidebarProps {
  onNavigate: () => void;
  className?: string;
  selectedCliente?: SidebarSelectedCliente | null;
  persona?: DashboardPersona;
}

export function DashboardMobileSidebar({
  onNavigate,
  className,
  selectedCliente = null,
  persona = "cliente",
}: DashboardMobileSidebarProps) {
  return (
    <aside
      className={cn(
        "dashboard-rail flex h-full shrink-0 flex-col bg-white",
        className,
      )}
    >
      <div className="border-b border-[var(--auth-divider)] px-4 py-4 pt-14">
        <div className="flex items-center justify-between gap-2 pr-8">
          <Link
            href={routes.overview}
            prefetch
            onClick={onNavigate}
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
          onNavigate={onNavigate}
          selectedCliente={selectedCliente}
          persona={persona}
        />
      </div>

      <div className="px-4 pt-4">
        <p className="px-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
          Menú
        </p>
      </div>

      <DashboardNavLinks onNavigate={onNavigate} persona={persona} />

      <div className="mt-auto border-t border-[var(--auth-divider)] p-4">
        <div className="rounded-[1rem] border border-[var(--auth-border)] bg-[var(--auth-bg)] p-3.5">
          <div className="flex items-start gap-2.5">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]"
              aria-hidden
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.2 13.7 8.3 20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2.2Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-[var(--auth-text)]">
                {siteConfig.name}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-4 text-[var(--auth-text-muted)]">
                Plataforma de marketing integral para marcas y agencias.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
