import Link from "next/link";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { DashboardNavLinks } from "./DashboardNavLinks.client";
import type { Wallet } from "@/types/wallet";

interface DashboardSidebarProps {
  wallet: Wallet;
  className?: string;
}

export function DashboardSidebar({ wallet, className }: DashboardSidebarProps) {
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
          className="flex min-w-0 items-center gap-2.5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-xs font-bold text-white shadow-sm shadow-indigo-500/20">
            DM
          </div>
          <span className="truncate text-sm font-bold tracking-tight text-[#0f172a]">
            {siteConfig.name}
          </span>
        </Link>

        <div className="mt-4 rounded-2xl border border-[#4056ff]/10 bg-gradient-to-br from-[#4056ff]/10 to-[#7c3aed]/5 p-3.5">
          <p className="truncate text-xs font-semibold text-[#4056ff]">
            {wallet.name}
          </p>
          <p className="mt-0.5 text-[10px] text-[#64748b]">Fondos disponibles</p>
          <p className="mt-2 text-lg font-bold text-[#0f172a]">
            {formatMoney(wallet.balance, wallet.currency)}
          </p>
          <Link
            href={routes.payments}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#4056ff] text-xs font-semibold text-white transition-all duration-200 hover:bg-[#4056ff]/90"
          >
            Agregar saldo
          </Link>
        </div>
      </div>

      <DashboardNavLinks />
    </aside>
  );
}
