"use client";

import Link from "next/link";
import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { useWallet } from "@/lib/hooks/use-wallet.client";
import { cn } from "@/lib/cn";

interface SidebarWalletCardProps {
  onNavigate?: () => void;
  className?: string;
}

export function SidebarWalletCard({
  onNavigate,
  className,
}: SidebarWalletCardProps) {
  const { wallet, loading } = useWallet();

  return (
    <div
      className={cn(
        "mt-4 overflow-hidden rounded-[1.35rem] border border-[#4056ff]/15 bg-[linear-gradient(135deg,rgba(64,86,255,0.12),rgba(124,58,237,0.07),rgba(255,255,255,0.72))] p-3.5 shadow-lg shadow-[#4056ff]/10 ring-1 ring-white/70",
        className,
      )}
    >
      <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-[#4056ff]">
        {wallet.name}
      </p>
      <p className="mt-1 text-[10px] font-medium text-[#64748b]">Fondos disponibles</p>
      <p
        className={cn(
          "mt-2 text-xl font-black tracking-[-0.03em] text-[#0f172a]",
          loading && "h-7 w-24 animate-pulse rounded bg-slate-200",
        )}
      >
        {!loading && formatMoney(wallet.balance, wallet.currency)}
      </p>
      <Link
        href={routes.payments}
        prefetch
        onClick={onNavigate}
        className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4056ff,#7c3aed)] text-xs font-bold text-white shadow-lg shadow-[#4056ff]/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[#4056ff]/30"
      >
        Agregar saldo
      </Link>
    </div>
  );
}
