import Link from "next/link";
import {
  CrmMetricCell,
  CrmMetricsStrip,
} from "@/components/dashboard/crm-ui";
import { GastosAdsLedger } from "@/features/clientes/components/GastosAdsLedger.client";
import { routes } from "@/config/routes";
import { formatHecomFecha } from "@/lib/hecom/gasto-label";
import {
  moneyUsd,
  type HecomClienteDashboard,
} from "@/lib/hecom/cliente-dashboard.server";

export function ClienteScopedGastos({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, gastos } = data;

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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--auth-divider)] pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
            Consumo ads
          </p>
          <h2 className="mt-1 text-[1.125rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            Gastos · {cliente.name}
          </h2>
          <p className="mt-1 text-[12px] text-[var(--auth-text-muted)]">
            Total por rango de fechas · solo lectura Hecom
          </p>
        </div>
        <Link
          href={routes.payments}
          className="text-[12px] font-semibold text-[var(--auth-accent)] hover:underline"
        >
          Ir a Pagos →
        </Link>
      </header>

      <CrmMetricsStrip>
        <div className="grid grid-cols-2 gap-px bg-[var(--auth-divider)] sm:grid-cols-3">
          <div className="bg-white">
            <CrmMetricCell
              label="Gasto de hoy"
              value={moneyUsd(summary.gastoHoy)}
              hint={
                summary.dailySource === "none"
                  ? "Sin sync"
                  : summary.gastoHoy > 0
                    ? anchoredOffToday
                      ? `Último · ${formatHecomFecha(summary.dailyAnchorDate)}`
                      : "America/Lima"
                    : "Sin actividad"
              }
              emphasis="primary"
            />
          </div>
          <div className="bg-white">
            <CrmMetricCell
              label="Últimos 7 días"
              value={moneyUsd(summary.gasto7d)}
            />
          </div>
          <div className="bg-white">
            <CrmMetricCell
              label="Total histórico"
              value={moneyUsd(summary.gastoTotal)}
              hint="Todos los registros Hecom"
            />
          </div>
        </div>
      </CrmMetricsStrip>

      <GastosAdsLedger
        gastos={gastos}
        title="Gasto en el período"
        subtitle="Elegí fechas y ves el total"
      />
    </div>
  );
}
