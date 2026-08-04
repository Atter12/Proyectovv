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
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
          Sin cliente
        </p>
        <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
          Elegí un cliente para filtrar todo el panel.
        </p>
        <Link
          href={routes.clientes}
          prefetch
          onClick={onNavigate}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] text-[13px] font-bold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
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
          className="shadow-[0_8px_20px_rgb(15_23_42_/_0.1)] ring-2 ring-white"
        />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
            Cliente activo
          </p>
          <p className="mt-1 truncate text-[15px] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)]">
            {selectedCliente.name}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[12px] font-medium text-[var(--auth-text-muted)]">
        {selectedCliente.saldoEstimado != null && selectedCliente.saldoEstimado < 0
          ? "Deuda neta Hecom"
          : "Saldo estimado Hecom"}
      </p>
      <p className="mt-1 text-[1.45rem] font-bold tracking-[-0.03em] text-[var(--auth-text)]">
        {selectedCliente.saldoEstimado == null
          ? "—"
          : formatMoney(selectedCliente.saldoEstimado, "USD")}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-[var(--auth-text-muted)]">
        Cobros − (gastos + fees). Fondear BM no la mueve.
      </p>
      <div className="mt-3 grid gap-2">
        <Link
          href={routes.payments}
          prefetch
          onClick={onNavigate}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] text-[13px] font-bold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
        >
          Ver pagos
        </Link>
        <Link
          href={routes.clientes}
          prefetch
          onClick={onNavigate}
          className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-[var(--auth-control-border)] bg-white text-[12px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)]"
        >
          Cambiar cliente
        </Link>
      </div>
    </div>
  );
}
