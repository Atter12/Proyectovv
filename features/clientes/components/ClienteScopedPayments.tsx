import Link from "next/link";
import { getTranslations } from "next-intl/server";
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

export async function ClienteScopedPayments({
  data,
  staffMode = false,
}: {
  data: HecomClienteDashboard;
  /** Gerente / path BM: copy de fondeo correcto. */
  staffMode?: boolean;
}) {
  const t = await getTranslations("payments");
  const { cliente, summary, cobros } = data;
  const recentCobros = cobros.slice(0, 5);

  const debtLabel = t("clienteScoped.debt");
  const estimatedLabel = t("clienteScoped.estimated");
  const feeLabel = t("clienteScoped.feeLabel");

  const kpis = [
    {
      label: feeLabel,
      value: `${summary.depositFeePercent}%`,
      hint: t("clienteScoped.feeHint"),
      emphasis: "muted" as const,
    },
    {
      label: t("clienteScoped.totalCobros"),
      value: moneyUsd(summary.cobroTotal),
      emphasis: "default" as const,
    },
    {
      label: t("clienteScoped.totalGastos"),
      value: moneyUsd(summary.gastoTotal),
      hint: t("clienteScoped.gastosHint"),
      emphasis: "default" as const,
    },
    ...(staffMode
      ? [
          {
            label: summary.saldoEstimado < 0 ? debtLabel : estimatedLabel,
            value: moneyUsd(summary.saldoEstimado),
            accent: summary.saldoEstimado < 0,
            emphasis: "primary" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--auth-divider)] pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
            {t("clienteScoped.eyebrow")}
          </p>
          <h2 className="mt-1 text-[1.125rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            {t("clienteScoped.title", { name: cliente.name })}
          </h2>
          <p className="mt-1 text-[12px] text-[var(--auth-text-muted)]">
            {t("clienteScoped.subtitle", {
              percent: summary.depositFeePercent,
            })}
            {staffMode ? t("clienteScoped.subtitleStaff") : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[12px] font-semibold">
          <Link
            href={routes.cobros}
            className="text-[var(--auth-accent)] hover:underline"
          >
            {t("clienteScoped.linkCobros")}
          </Link>
          <Link
            href={routes.profit}
            className="text-[var(--auth-accent)] hover:underline"
          >
            {t("clienteScoped.linkProfit")}
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
                emphasis={kpi.emphasis}
              />
            </div>
          ))}
        </div>
      </CrmMetricsStrip>

      <CrmPanel
        title={t("clienteScoped.recentTitle")}
        subtitle={
          cobros.length === 1
            ? t("clienteScoped.recordsOne", { count: cobros.length })
            : t("clienteScoped.recordsMany", { count: cobros.length })
        }
        className="overflow-hidden"
      >
        {recentCobros.length === 0 ? (
          <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
            {t("clienteScoped.empty")}
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
                      {row.metodo ?? t("clienteScoped.defaultMethod")}
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
                          {t("clienteScoped.withProof")}
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
              {t("clienteScoped.viewAll")}
            </Link>
          </div>
        ) : cobros.length > 0 ? (
          <div className="border-t border-[var(--auth-divider)] px-5 py-3">
            <Link
              href={routes.cobros}
              className="text-[12px] font-semibold text-[var(--auth-accent)] hover:underline"
            >
              {t("clienteScoped.openProofs")}
            </Link>
          </div>
        ) : null}
      </CrmPanel>
    </div>
  );
}
