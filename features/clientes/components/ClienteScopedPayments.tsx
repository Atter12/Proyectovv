import Link from "next/link";
import {
  CrmMetricCell,
  CrmMetricsStrip,
  CrmPanel,
} from "@/components/dashboard/crm-ui";
import { formatHecomFecha } from "@/lib/hecom/gasto-label";
import {
  moneyUsd,
  type HecomClienteDashboard,
  type HecomCobroRow,
} from "@/lib/hecom/cliente-dashboard.server";
import { routes } from "@/config/routes";

export function ClienteScopedPayments({
  data,
  staffMode = false,
}: {
  data: HecomClienteDashboard;
  /** Gerente / path BM: copy de fondeo correcto. */
  staffMode?: boolean;
}) {
  const { cliente, summary, cobros } = data;
  const recentCobros = cobros.slice(0, 5);

  const kpis = [
    {
      label: "Fee Holistic",
      value: `${summary.depositFeePercent}%`,
      hint: "Hecom Club",
    },
    {
      label: "Total cobros",
      value: moneyUsd(summary.cobroTotal),
    },
    {
      label: "Total gastos",
      value: moneyUsd(summary.gastoTotal),
      hint: "Ver detalle en Gastos",
    },
    ...(staffMode
      ? [
          {
            label: summary.saldoEstimado < 0 ? "Deuda neta" : "Saldo estimado",
            value: moneyUsd(summary.saldoEstimado),
            accent: summary.saldoEstimado < 0,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--auth-divider)] pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
            Historial Hecom
          </p>
          <h2 className="mt-1 text-[1.125rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            Cobros / recargas · {cliente.name}
          </h2>
          <p className="mt-1 text-[12px] text-[var(--auth-text-muted)]">
            Solo lectura CRM · Fee {summary.depositFeePercent}%
            {staffMode ? " · Recarga BM no reduce deuda neta" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[12px] font-semibold">
          <Link
            href={routes.cobros}
            className="text-[var(--auth-accent)] hover:underline"
          >
            Ver lo pagado →
          </Link>
          <Link
            href={routes.profit}
            className="text-[var(--auth-accent)] hover:underline"
          >
            Ver Profit →
          </Link>
        </div>
      </header>

      <CrmMetricsStrip>
        <div
          className={`grid grid-cols-2 gap-px bg-[var(--auth-divider)] ${
            staffMode ? "sm:grid-cols-4" : "sm:grid-cols-3"
          }`}
        >
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white">
              <CrmMetricCell
                label={kpi.label}
                value={kpi.value}
                hint={"hint" in kpi ? kpi.hint : undefined}
                emphasis={
                  kpi.label.includes("Saldo") || kpi.label.includes("Deuda")
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

      <CrmPanel
        title="Últimos cobros"
        subtitle={`${cobros.length} registro${cobros.length === 1 ? "" : "s"} en Hecom`}
        className="overflow-hidden"
      >
        {recentCobros.length === 0 ? (
          <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
            Sin cobros para este cliente.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--auth-divider)]">
            {recentCobros.map((row: HecomCobroRow) => {
              const fecha = formatHecomFecha(row.fecha);
              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-[var(--auth-bg)]"
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
                      {row.comprobanteUrls.length > 0 ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                          Con comprobante
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
          </ul>
        )}
        {cobros.length > recentCobros.length ? (
          <div className="border-t border-[var(--auth-divider)] px-5 py-3">
            <Link
              href={routes.cobros}
              className="text-[12px] font-semibold text-[var(--auth-accent)] hover:underline"
            >
              Ver todos los pagos y comprobantes →
            </Link>
          </div>
        ) : cobros.length > 0 ? (
          <div className="border-t border-[var(--auth-divider)] px-5 py-3">
            <Link
              href={routes.cobros}
              className="text-[12px] font-semibold text-[var(--auth-accent)] hover:underline"
            >
              Abrir comprobantes →
            </Link>
          </div>
        ) : null}
      </CrmPanel>
    </div>
  );
}
