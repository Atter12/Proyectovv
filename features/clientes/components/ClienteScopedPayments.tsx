import type { ReactNode } from "react";
import {
  CrmMetricCell,
  CrmMetricsStrip,
  CrmPanel,
} from "@/components/dashboard/crm-ui";
import {
  formatHecomFecha,
} from "@/lib/hecom/gasto-label";
import {
  moneyUsd,
  type HecomClienteDashboard,
  type HecomCobroRow,
} from "@/lib/hecom/cliente-dashboard.server";
import { GastosAdsLedger } from "@/features/clientes/components/GastosAdsLedger.client";
import { CampaignSpendExplorer } from "@/features/clientes/components/CampaignSpendExplorer.client";

export function ClienteScopedPayments({
  data,
  staffMode = false,
}: {
  data: HecomClienteDashboard;
  /** Gerente / path BM: copy de fondeo correcto. */
  staffMode?: boolean;
}) {
  const { cliente, summary, cobros, gastos, campaignSpendRows, accounts } = data;

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
      <header className="border-b border-[var(--auth-divider)] pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
          Historial Hecom
        </p>
        <h2 className="mt-1 text-[1.125rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
          Cobrado y gastado · {cliente.name}
        </h2>
        <p className="mt-1 text-[12px] text-[var(--auth-text-muted)]">
          Solo lectura CRM · Fee {summary.depositFeePercent}%
          {staffMode ? " · Recarga BM no reduce deuda neta" : ""}
        </p>
      </header>

      <CrmMetricsStrip>
        <div className="grid grid-cols-2 gap-px bg-[var(--auth-divider)] sm:grid-cols-4 lg:grid-cols-7">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white">
              <CrmMetricCell
                label={kpi.label}
                value={kpi.value}
                hint={"hint" in kpi ? kpi.hint : undefined}
                emphasis={
                  kpi.label === "Gasto de hoy" || kpi.label.includes("Saldo") || kpi.label.includes("Deuda")
                    ? "primary"
                    : kpi.label === "Fee Holistic"
                      ? "muted"
                      : "default"
                }
              />
            </div>
          ))}
        </div>
      </CrmMetricsStrip>

      <CampaignSpendExplorer rows={campaignSpendRows} />

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

        <GastosAdsLedger gastos={gastos} accounts={accounts} />
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
    <CrmPanel
      title={title}
      subtitle={`${subtitle} · ${total} registro${total === 1 ? "" : "s"}`}
      className="flex h-full flex-col overflow-hidden"
    >
      {total === 0 ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
          {empty}
        </p>
      ) : (
        <ul className="max-h-[28rem] flex-1 overflow-y-auto">{children}</ul>
      )}
    </CrmPanel>
  );
}
