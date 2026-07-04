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
        "mt-4 rounded-2xl border border-[#4056ff]/12 bg-gradient-to-br from-[#4056ff]/10 via-[#4056ff]/5 to-[#7c3aed]/5 p-3.5 shadow-sm shadow-[#4056ff]/5",
        className,
      )}
    >
      <p className="truncate text-xs font-semibold text-[#4056ff]">
        {wallet.name}
      </p>
      <p className="mt-0.5 text-[10px] text-[#64748b]">Fondos disponibles</p>
      <p
        className={cn(
          "mt-2 text-lg font-bold text-[#0f172a]",
          loading && "h-7 w-24 animate-pulse rounded bg-slate-200",
        )}
      >
        {!loading && formatMoney(wallet.balance, wallet.currency)}
      </p>
      <Link
        href={routes.payments}
        prefetch
        onClick={onNavigate}
        className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#4056ff] text-xs font-semibold text-white shadow-sm shadow-[#4056ff]/20 transition-all duration-200 hover:bg-[#4d62ff] hover:shadow-md hover:shadow-[#4056ff]/25"
      >
        Agregar saldo
      </Link>
    </div>
  );
}
