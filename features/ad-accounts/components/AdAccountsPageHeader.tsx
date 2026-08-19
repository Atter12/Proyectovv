import Link from "next/link";
import { routes } from "@/config/routes";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
  hecomScoped?: boolean;
  clienteName?: string;
  clienteId?: string;
  avatarUrl?: string | null;
  hideCreate?: boolean;
}

/**
 * Cuentas ads — cabecera clara alineada a Overview / Pagos.
 */
export function AdAccountsPageHeader({
  summary,
  hecomScoped = false,
  clienteName,
  avatarUrl,
  hideCreate = false,
}: AdAccountsPageHeaderProps) {
  const description = hecomScoped
    ? `Cuentas TikTok de ${clienteName ?? "este cliente"}: activas y suspendidas (solo lectura).`
    : "Seleccioná un cliente para ver sus cuentas publicitarias.";

  return (
    <div className="space-y-5">
      <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {hecomScoped && clienteName ? (
                <HecomClienteAvatar
                  name={clienteName}
                  avatarUrl={avatarUrl}
                  size="md"
                />
              ) : (
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#16161a] text-[9px] font-bold">
                  <span className="text-[#25f4ee]">T</span>
                  <span className="text-[#fe2c55]">T</span>
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
                  Cuentas ads
                </p>
                {hecomScoped && clienteName ? (
                  <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--auth-text-muted)]">
                    {clienteName}
                  </p>
                ) : null}
              </div>
            </div>

            <h1 className="mt-3 text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.65rem]">
              Mis cuentas publicitarias
            </h1>
            <p className="mt-2 max-w-xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
              {description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={routes.payments}
                className="inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
              >
                Ir a pagos
              </Link>
              <Link
                href={routes.overview}
                className="inline-flex h-10 items-center rounded-lg border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)] hover:text-[var(--auth-accent)]"
              >
                Resumen
              </Link>
              {hideCreate ? null : (
                <AdAccountsOpenCreateModalButton className="inline-flex h-10 items-center rounded-lg border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)]">
                  Crear cuenta
                </AdAccountsOpenCreateModalButton>
              )}
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[1rem] border border-[var(--auth-border)] bg-[var(--auth-bg)] p-4 lg:min-w-[240px]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
              Saldo asignado
            </p>
            <p className="mt-2 text-[1.85rem] font-bold leading-none tracking-[-0.04em] tabular-nums text-[var(--auth-text)]">
              {formatMoney(summary.assignedBalance)}
            </p>
            <p className="mt-2 text-[12px] text-[var(--auth-text-muted)]">
              {formatNumber(summary.activeAccounts)} activa
              {summary.activeAccounts === 1 ? "" : "s"}
              {(summary.disabledAccounts ?? 0) > 0
                ? ` · ${formatNumber(summary.disabledAccounts ?? 0)} suspendida${
                    (summary.disabledAccounts ?? 0) === 1 ? "" : "s"
                  }`
                : ""}{" "}
              · {formatNumber(summary.totalAccounts)} total
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Totales" value={formatNumber(summary.totalAccounts)} />
        <Kpi
          label="Activas"
          value={formatNumber(summary.activeAccounts)}
          accent
        />
        <Kpi label="Saldo" value={formatMoney(summary.assignedBalance)} />
        <Kpi
          label="Suspendidas"
          value={formatNumber(summary.disabledAccounts ?? 0)}
        />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="dashboard-kpi rounded-[1rem] px-4 py-3.5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
        {label}
      </p>
      <p
        className={`mt-1.5 truncate text-[1.2rem] font-bold tracking-[-0.03em] tabular-nums ${
          accent ? "text-[var(--auth-accent)]" : "text-[var(--auth-text)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
