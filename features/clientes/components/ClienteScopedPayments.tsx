import type { ReactNode } from "react";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import {
  formatHecomFecha,
  formatHecomGastoDisplay,
} from "@/lib/hecom/gasto-label";
import {
  moneyUsd,
  type HecomClienteDashboard,
  type HecomCobroRow,
  type HecomGastoRow,
} from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedPayments({
  data,
  staffMode = false,
}: {
  data: HecomClienteDashboard;
  /** Gerente / path BM: copy de fondeo correcto. */
  staffMode?: boolean;
}) {
  const { cliente, summary, cobros, gastos } = data;

  const todayLima = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const anchoredOffToday =
    Boolean(summary.dailyAnchorDate) &&
    summary.dailyAnchorDate !== todayLima &&
    summary.gastoHoy > 0;

  const kpis = [
    {
      label: "Fee Holistic",
      value: `${summary.depositFeePercent}%`,
      accent: true as const,
      hint: "Hecom Club",
    },
    {
      label: "Gasto de hoy",
      value: moneyUsd(summary.gastoHoy),
      hint:
        summary.dailySource === "none"
          ? "Sin sync"
          : summary.gastoHoy > 0
            ? anchoredOffToday
              ? `Último día · ${formatHecomFecha(summary.dailyAnchorDate)}`
              : "America/Lima"
            : "Sin actividad",
    },
    {
      label: "Últimos 7 días",
      value: moneyUsd(summary.gasto7d),
      hint:
        summary.gasto7d > 0 && anchoredOffToday
          ? `Hasta ${formatHecomFecha(summary.dailyAnchorDate)}`
          : undefined,
    },
    {
      label: "Total cobros",
      value: moneyUsd(summary.cobroTotal),
    },
    {
      label: "Total gastos",
      value: moneyUsd(summary.gastoTotal),
    },
    {
      label: "Fees $",
      value: moneyUsd(summary.feeTotal),
      hint: `${summary.depositFeePercent}% cliente`,
    },
    {
      label: summary.saldoEstimado < 0 ? "Deuda neta" : "Saldo estimado",
      value: moneyUsd(summary.saldoEstimado),
      accent: summary.saldoEstimado < 0,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
        <div className="border-b border-[var(--auth-divider)] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <HecomClienteAvatar
              name={cliente.name}
              avatarUrl={cliente.avatarUrl}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
                Historial Hecom
              </p>
              <h2 className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                Cobrado y gastado · {cliente.name}
              </h2>
              <p className="mt-1 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
                {staffMode
                  ? "Solo lectura del CRM. La recarga BM suma presupuesto a ads y no reduce la deuda neta — baja con cobro del cliente."
                  : "Solo lectura del CRM. La recarga se hace con la cartera de arriba."}{" "}
                Fee del cliente:{" "}
                <span className="font-semibold text-[var(--auth-text)]">
                  {summary.depositFeePercent}%
                </span>
                .
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[var(--auth-divider)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white px-4 py-4 sm:px-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
                {kpi.label}
              </p>
              <p
                className={`mt-1.5 truncate text-[1.15rem] font-bold tracking-[-0.03em] tabular-nums ${
                  kpi.accent
                    ? "text-[var(--auth-accent)]"
                    : "text-[var(--auth-text)]"
                }`}
              >
                {kpi.value}
              </p>
              {"hint" in kpi && kpi.hint ? (
                <p className="mt-1 text-[11px] font-medium text-[var(--auth-text-soft)]">
                  {kpi.hint}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <LedgerPanel
          title="Cobros / recargas"
          subtitle="Ingresos en Hecom"
          total={cobros.length}
          empty="Sin cobros para este cliente."
        >
          {cobros.map((row) => {
            const fecha = formatHecomFecha(row.fecha);
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 last:border-0 hover:bg-[var(--auth-bg)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                    {row.metodo ?? "Cobro"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--auth-text-muted)]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.codigo ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--auth-text-muted)]">
                        {row.codigo}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[#1f5c40]">
                  {moneyUsd(row.monto)}
                </p>
              </li>
            );
          })}
        </LedgerPanel>

        <LedgerPanel
          title="Gastos ads"
          subtitle="Consumo del día · “Paquete” es BM"
          total={gastos.length}
          empty="Sin gastos para este cliente."
        >
          {gastos.map((row) => {
            const fecha = formatHecomFecha(row.fecha ?? row.mes);
            const label = formatHecomGastoDisplay(row.camp, {
              notas: row.notas,
              fee: null,
              fecha: null,
            });
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 last:border-0 hover:bg-[var(--auth-bg)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                    {label.title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--auth-text-muted)]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.fee != null ? (
                      <span className="rounded bg-[var(--auth-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--auth-accent)]">
                        Fee {row.fee}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--auth-text)]">
                  {moneyUsd(row.gasto)}
                </p>
              </li>
            );
          })}
        </LedgerPanel>
      </div>
    </div>
  );
}

function LedgerPanel({
  title,
  subtitle,
  total,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1rem]">
      <div className="border-b border-[var(--auth-divider)] px-5 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            {title}
          </h3>
          <span className="rounded-md bg-[var(--auth-accent-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--auth-accent)]">
            {total}
          </span>
        </div>
        <p className="mt-1 text-[12px] font-medium text-[var(--auth-text-muted)]">
          {subtitle}
        </p>
      </div>
      {total === 0 ? (
        <p className="px-5 py-10 text-[13px] font-medium text-[var(--auth-text-muted)]">
          {empty}
        </p>
      ) : (
        <ul className="max-h-[28rem] flex-1 overflow-y-auto">{children}</ul>
      )}
    </section>
  );
}
