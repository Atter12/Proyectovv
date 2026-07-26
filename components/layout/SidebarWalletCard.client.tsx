"use client";

import Link from "next/link";
import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/cn";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";

export type SidebarSelectedCliente = {
  id: string;
  name: string;
  saldoEstimado: number | null;
  avatarUrl?: string | null;
};

interface SidebarWalletCardProps {
  onNavigate?: () => void;
  className?: string;
  selectedCliente?: SidebarSelectedCliente | null;
}

export function SidebarWalletCard({
  onNavigate,
  className,
  selectedCliente = null,
}: SidebarWalletCardProps) {
  if (!selectedCliente) {
    return (
      <div className={cn("dashboard-rail-glass mt-4 rounded-2xl p-3.5", className)}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-accent)]">
          Sin cliente
        </p>
        <p className="mt-2 text-[13px] leading-5 text-[#9a9187]">
          Elegí un cliente para filtrar todo el panel.
        </p>
        <Link
          href={routes.clientes}
          prefetch
          onClick={onNavigate}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] text-[13px] font-semibold text-white shadow-[0_8px_22px_rgb(255_120_31_/_0.22)] transition-[background-color,transform] hover:bg-[var(--brand-primary-deep)] active:translate-y-px"
        >
          Ir a Clientes
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("dashboard-rail-glass mt-4 rounded-2xl p-3.5", className)}>
      <div className="flex items-center gap-3">
        <HecomClienteAvatar
          name={selectedCliente.name}
          avatarUrl={selectedCliente.avatarUrl}
          size="sidebar"
          className="shadow-[0_8px_20px_rgb(0_0_0_/_0.35)] ring-2 ring-white/25"
        />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-accent)]">
            Cliente activo
          </p>
          <p className="mt-1 truncate text-[15px] font-semibold leading-snug text-white">
            {selectedCliente.name}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[12px] font-medium text-[#9a9187]">
        Saldo estimado (Hecom)
      </p>
      <p className="mt-1 font-display text-[1.45rem] font-medium tracking-[-0.03em] text-white">
        {selectedCliente.saldoEstimado == null
          ? "—"
          : formatMoney(selectedCliente.saldoEstimado, "USD")}
      </p>
      <div className="mt-3 grid gap-2">
        <Link
          href={routes.payments}
          prefetch
          onClick={onNavigate}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] text-[13px] font-semibold text-white shadow-[0_8px_22px_rgb(255_120_31_/_0.22)] transition-[background-color,transform] hover:bg-[var(--brand-primary-deep)] active:translate-y-px"
        >
          Ver pagos
        </Link>
        <Link
          href={routes.clientes}
          prefetch
          onClick={onNavigate}
          className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[12px] font-semibold text-[#d0dae8] transition-colors hover:bg-white/10 hover:text-white"
        >
          Cambiar cliente
        </Link>
      </div>
    </div>
  );
}
