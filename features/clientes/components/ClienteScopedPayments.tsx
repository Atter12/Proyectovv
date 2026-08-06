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
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, cobros, gastos } = data;
  const listCobros = cobros;
  const listGastos = gastos;

  const kpis = [
    {
      label: "Total cobros",
      value: moneyUsd(summary.cobroTotal),
      accent: true as const,
    },
    {
      label: "Total gastos",
      value: moneyUsd(summary.gastoTotal),
    },
    {
      label: "Fees",
      value: moneyUsd(summary.feeTotal),
    },
    {
      label: summary.saldoEstimado < 0 ? "Deuda neta" : "Saldo estimado",
      value: moneyUsd(summary.saldoEstimado),
      accent: summary.saldoEstimado < 0,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.07)] bg-[#0f0e0c] text-white shadow-[0_18px_40px_rgb(15_14_12_/_0.18)]">
        <div className="border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-start gap-3">
            <HecomClienteAvatar
              name={cliente.name}
              avatarUrl={cliente.avatarUrl}
              size="md"
              className="ring-2 ring-white/15"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4a]">
                Historial Hecom
              </p>
              <h2 className="font-display mt-1.5 text-[1.35rem] font-semibold tracking-[-0.03em] text-white sm:text-[1.5rem]">
                Ya cobrado y gastado · {cliente.name}
              </h2>
              <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-white/55">
                Solo lectura del CRM: cobros que ya entraron y gastos
                consumidos. Para fondear, usá la cartera Holistic de arriba —
                no se paga por campaña.
              </p>
            </div>
          </div>
        </div>

        <div aria-label="Resumen Hecom" className="grid grid-cols-2 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="border-t border-white/10 px-5 py-5 sm:border-t-0 sm:border-l sm:border-white/10 sm:px-6 sm:first:border-l-0"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                {kpi.label}
              </p>
              <p
                className={`mt-2 truncate font-display text-[1.15rem] font-semibold tracking-[-0.03em] tabular-nums sm:text-[1.3rem] ${
                  kpi.accent ? "text-[#ff9a4a]" : "text-white"
                }`}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <CobrosPanel rows={listCobros} total={cobros.length} />
        <GastosPanel rows={listGastos} total={gastos.length} />
      </div>
    </div>
  );
}

function CobrosPanel({
  rows,
  total,
}: {
  rows: HecomCobroRow[];
  total: number;
}) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
              Cobros / recargas
            </h3>
            <span className="rounded-md bg-[rgb(255_120_31_/_0.1)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--auth-accent)]">
              {total}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Ingresos registrados en Hecom
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-6">
          Sin cobros para este cliente.
        </p>
      ) : (
        <ul className="max-h-[28rem] flex-1 overflow-y-auto">
          {rows.map((row) => {
            const fecha = formatHecomFecha(row.fecha);
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[rgb(255_248_243_/_0.7)] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
                    {row.metodo ?? "Cobro"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--auth-text-muted)]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.codigo ? (
                      <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--auth-text-muted)]">
                        {row.codigo}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[#1f5c40]">
                  {moneyUsd(row.monto)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GastosPanel({
  rows,
  total,
}: {
  rows: HecomGastoRow[];
  total: number;
}) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
              Gastos ads
            </h3>
            <span className="rounded-md bg-[rgb(255_120_31_/_0.1)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--auth-accent)]">
              {total}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Monto = gasto del día · “Paquete” es BM, no el spend
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-6">
          Sin gastos para este cliente.
        </p>
      ) : (
        <ul className="max-h-[28rem] flex-1 overflow-y-auto">
          {rows.map((row) => {
            const fecha = formatHecomFecha(row.fecha ?? row.mes);
            const label = formatHecomGastoDisplay(row.camp, {
              notas: row.notas,
              fee: null,
              fecha: null,
            });
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[rgb(255_248_243_/_0.7)] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
                    {label.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--auth-text-muted)]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.fee != null ? (
                      <span className="rounded bg-[rgb(255_120_31_/_0.1)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--auth-accent)]">
                        Fee {row.fee}%
                      </span>
                    ) : null}
                    {label.meta ? (
                      <span className="truncate text-[11px] text-[var(--auth-text-soft)]">
                        {label.meta}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--auth-text)]">
                  {moneyUsd(row.gasto)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
