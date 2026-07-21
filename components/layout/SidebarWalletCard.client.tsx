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
        "mt-4 overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15 bg-[linear-gradient(160deg,rgb(23_139_255_/_0.1),rgb(255_255_255_/_0.92)_55%)] p-3.5 shadow-sm",
        className,
      )}
    >
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        {wallet.name}
      </p>
      <p className="mt-1 text-[12px] font-medium text-[var(--admin-text-muted,#64748b)]">
        Fondos disponibles
      </p>
      <p
        className={cn(
          "mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]",
          loading && "h-7 w-28 animate-pulse rounded-md bg-slate-200",
        )}
      >
        {!loading && formatMoney(wallet.balance, wallet.currency)}
      </p>
      <Link
        href={routes.payments}
        prefetch
        onClick={onNavigate}
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] text-[13px] font-semibold text-white shadow-[0_8px_18px_rgb(23_139_255_/_0.25)] transition-[background-color,transform] hover:bg-[var(--brand-primary-deep)] active:translate-y-px"
      >
        Agregar saldo
      </Link>
    </div>
  );
}
