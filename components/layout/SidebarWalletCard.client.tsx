"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { cn } from "@/lib/cn";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import type { DashboardPersona } from "@/types/dashboard-persona";

export type SidebarSelectedCliente = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Gerente / super admin: posición Hecom (cobros − gastos − fees). */
  saldoEstimado?: number | null;
  /** Cliente: cartera Holistic disponible (recargas Stripe − asignaciones). */
  walletBalanceCents?: number | null;
  walletCurrency?: string;
};

interface SidebarWalletCardProps {
  onNavigate?: () => void;
  className?: string;
  selectedCliente?: SidebarSelectedCliente | null;
  persona?: DashboardPersona;
  actingAsCliente?: boolean;
}

export function SidebarWalletCard({
  onNavigate,
  className,
  selectedCliente = null,
  persona = "cliente",
  actingAsCliente = false,
}: SidebarWalletCardProps) {
  const t = useTranslations("wallet");
  const { formatMoney } = useAppFormatter();
  const canPickClients = persona !== "cliente" || actingAsCliente;
  // Cliente y staff: mostrar cartera Holistic (no el estimado Hecom con “…”).
  const showClientWallet =
    persona === "cliente" ||
    selectedCliente?.walletBalanceCents != null;

  if (!selectedCliente) {
    if (!canPickClients) {
      return (
        <div className={cn("dashboard-rail-glass mt-5 p-4", className)}>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
            {t("yourAccount")}
          </p>
          <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
{t("clienteHint")}
          </p>
          <Link
            href={routes.payments}
            prefetch
            onClick={onNavigate}
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-[var(--auth-accent)] text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
          >
            {t("goPayments")}
          </Link>
        </div>
      );
    }

    return (
      <div className={cn("dashboard-rail-glass mt-5 p-4", className)}>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
          {t("noClient")}
        </p>
        <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
{t("staffHint")}
        </p>
        <Link
          href={routes.clientes}
          prefetch
          onClick={onNavigate}
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-[var(--auth-accent)] text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgb(255_120_31_/_0.65)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
        >
          {t("seeClients")}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("dashboard-rail-glass mt-5 p-4", className)}>
      <div className="flex items-center gap-3">
        <HecomClienteAvatar
          name={selectedCliente.name}
          avatarUrl={selectedCliente.avatarUrl}
          size="sidebar"
          className="ring-2 ring-white"
        />
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
            {actingAsCliente
              ? t("viewingAs")
              : canPickClients
                ? t("operating")
                : t("yourAccount")}
          </p>
          <p className="mt-1 truncate text-[14px] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)]">
            {selectedCliente.name}
          </p>
        </div>
      </div>

      {showClientWallet ? (
        <div className="mt-4 border-t border-[var(--auth-divider)] pt-4">
          <p className="text-[11px] font-medium text-[var(--auth-text-muted)]">
            {t("balance")}
          </p>
          <p className="mt-1 text-[1.35rem] font-bold tracking-[-0.03em] tabular-nums text-[var(--auth-text)]">
            {selectedCliente.walletBalanceCents == null
              ? "…"
              : formatMoney(
                  selectedCliente.walletBalanceCents / 100,
                  selectedCliente.walletCurrency ?? "USD",
                )}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--auth-text-muted)]">
            {t("availableHint")}
          </p>
        </div>
      ) : (
        <div className="mt-4 border-t border-[var(--auth-divider)] pt-4">
          <p className="text-[11px] font-medium text-[var(--auth-text-muted)]">
            {selectedCliente.saldoEstimado != null &&
            selectedCliente.saldoEstimado < 0
              ? t("hecomDebt")
              : t("hecomBalance")}
          </p>
          <p className="mt-1 text-[1.35rem] font-bold tracking-[-0.03em] tabular-nums text-[var(--auth-text)]">
            {selectedCliente.saldoEstimado == null
              ? "…"
              : formatMoney(selectedCliente.saldoEstimado, "USD")}
          </p>
        </div>
      )}

      <div
        className={cn(
          "mt-4 grid gap-2",
          canPickClients ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        <Link
          href={routes.payments}
          prefetch
          onClick={onNavigate}
          className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[var(--auth-accent)] text-[12px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
        >
          {showClientWallet ? t("payments") : t("recharge")}
        </Link>
        {canPickClients ? (
          <Link
            href={routes.clientes}
            prefetch
            onClick={onNavigate}
            className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[var(--auth-control-border)] bg-white text-[12px] font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)] hover:text-[var(--auth-accent)]"
          >
            {t("change")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
