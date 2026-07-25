"use client";

import Link from "next/link";
import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/cn";

export type SidebarSelectedCliente = {
  id: string;
  name: string;
  saldoEstimado: number | null;
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
      <div
        className={cn(
          "mt-4 overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3.5 shadow-sm",
          className,
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
          Sin cliente
        </p>
        <p className="mt-2 text-[13px] leading-5 text-amber-950/80">
          Elegí un cliente para filtrar todo el panel.
        </p>
        <Link
          href={routes.clientes}
          prefetch
          onClick={onNavigate}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] text-[13px] font-semibold text-white shadow-[0_8px_18px_rgb(23_139_255_/_0.25)] transition-[background-color,transform] hover:bg-[var(--brand-primary-deep)] active:translate-y-px"
        >
          Ir a Clientes
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-4 overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15 bg-[linear-gradient(160deg,rgb(23_139_255_/_0.1),rgb(255_255_255_/_0.92)_55%)] p-3.5 shadow-sm",
        className,
      )}
    >
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
        Cliente activo
      </p>
      <p className="mt-1 truncate text-[14px] font-semibold text-[var(--foreground)]">
        {selectedCliente.name}
      </p>
      <p className="mt-2 text-[12px] font-medium text-[var(--admin-text-muted,#64748b)]">
        Saldo estimado (Hecom)
      </p>
      <p className="mt-1 text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
        {selectedCliente.saldoEstimado == null
          ? "—"
          : formatMoney(selectedCliente.saldoEstimado, "USD")}
      </p>
      <div className="mt-3 grid gap-2">
        <Link
          href={routes.payments}
          prefetch
          onClick={onNavigate}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] text-[13px] font-semibold text-white shadow-[0_8px_18px_rgb(23_139_255_/_0.25)] transition-[background-color,transform] hover:bg-[var(--brand-primary-deep)] active:translate-y-px"
        >
          Ver pagos
        </Link>
        <Link
          href={routes.clientes}
          prefetch
          onClick={onNavigate}
          className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-white text-[12px] font-semibold text-[var(--brand-primary)]"
        >
          Cambiar cliente
        </Link>
      </div>
    </div>
  );
}
