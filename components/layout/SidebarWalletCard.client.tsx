"use client";

import Link from "next/link";
import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/cn";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import type { DashboardPersona } from "@/types/dashboard-persona";

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
  persona?: DashboardPersona;
}

export function SidebarWalletCard({
  onNavigate,
  className,
  selectedCliente = null,
  persona = "cliente",
}: SidebarWalletCardProps) {
  const canPickClients = persona !== "cliente";

  if (!selectedCliente) {
    if (!canPickClients) {
      return (
        <div className={cn("dashboard-rail-glass mt-4 rounded-xl p-3.5", className)}>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
            Tu cuenta
          </p>
          <p className="mt-1.5 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Recargá saldo con Stripe y asignalo a tus cuentas ads.
          </p>
          <Link
            href={routes.payments}
            prefetch
            onClick={onNavigate}
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--auth-accent)] text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
          >
            Ir a pagos
          </Link>
        </div>
      );
    }

    return (
      <div className={cn("dashboard-rail-glass mt-4 rounded-xl p-3.5", className)}>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
          Sin cliente
        </p>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
          Elegí un cliente del CRM para fondear desde el BM.
        </p>
        <Link
          href={routes.clientes}
          prefetch
          onClick={onNavigate}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--auth-accent)] text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgb(255_120_31_/_0.65)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
        >
          Ver clientes
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("dashboard-rail-glass mt-4 rounded-xl p-3.5", className)}>
      <div className="flex items-center gap-2.5">
        <HecomClienteAvatar
          name={selectedCliente.name}
          avatarUrl={selectedCliente.avatarUrl}
          size="sidebar"
          className="ring-2 ring-white"
        />
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
            {canPickClients ? "Operando" : "Tu cuenta"}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)]">
            {selectedCliente.name}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--auth-divider)] pt-3">
        <p className="text-[11px] font-medium text-[var(--auth-text-muted)]">
          {selectedCliente.saldoEstimado != null && selectedCliente.saldoEstimado < 0
            ? "Deuda neta Hecom"
            : "Saldo estimado"}
        </p>
        <p className="mt-0.5 text-[1.35rem] font-bold tracking-[-0.03em] tabular-nums text-[var(--auth-text)]">
          {selectedCliente.saldoEstimado == null
            ? "…"
            : formatMoney(selectedCliente.saldoEstimado, "USD")}
        </p>
      </div>

      <div
        className={cn(
          "mt-3 grid gap-2",
          canPickClients ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        <Link
          href={routes.payments}
          prefetch
          onClick={onNavigate}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--auth-accent)] text-[12px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
        >
          {canPickClients ? "Fondear" : "Pagos"}
        </Link>
        {canPickClients ? (
          <Link
            href={routes.clientes}
            prefetch
            onClick={onNavigate}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--auth-control-border)] bg-white text-[12px] font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)] hover:text-[var(--auth-accent)]"
          >
            Cambiar
          </Link>
        ) : null}
      </div>
    </div>
  );
}
