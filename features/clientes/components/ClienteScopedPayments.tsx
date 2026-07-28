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
      accent: "bg-[#2f7a57]",
      tone: "text-[#1f5c40]",
    },
    {
      label: "Total gastos",
      value: moneyUsd(summary.gastoTotal),
      accent: "bg-[#c45a18]",
      tone: "text-[#1a1612]",
    },
    {
      label: "Saldo estimado",
      value: moneyUsd(summary.saldoEstimado),
      accent: "bg-[#b45309]",
      tone: "text-[#1a1612]",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
        <div className="relative px-5 py-5 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#e85a1c,#ffa12c)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgb(255_120_31_/_0.05),transparent)]"
          />
          <div className="relative flex min-w-0 items-start gap-3 pl-2">
            <HecomClienteAvatar
              name={cliente.name}
              avatarUrl={cliente.avatarUrl}
              size="md"
              className="ring-1 ring-white shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c45a18]">
                Historial Hecom
              </p>
              <h2 className="mt-1 text-[1.25rem] font-semibold tracking-[-0.03em] text-[#1a1612] sm:text-[1.35rem]">
                Ya cobrado y gastado · {cliente.name}
              </h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
                Solo lectura del CRM: cobros que ya entraron y gastos que ya se
                consumieron. Para fondear, usá la cartera Holistic de arriba —
                no se paga por campaña.
              </p>
            </div>
          </div>
        </div>

        <div
          aria-label="Resumen Hecom"
          className="border-t border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3]"
        >
          <div className="grid sm:grid-cols-3">
            {kpis.map((kpi, index) => (
              <div
                key={kpi.label}
                className={`relative px-4 py-3.5 sm:px-5 ${
                  index < kpis.length - 1
                    ? "border-b border-[rgb(20_18_16_/_0.06)] sm:border-b-0 sm:border-r"
                    : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${kpi.accent}`}
                />
                <p className="pl-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8178]">
                  {kpi.label}
                </p>
                <p
                  className={`mt-1 truncate pl-2 text-[1.2rem] font-semibold tracking-[-0.03em] tabular-nums ${kpi.tone}`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
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
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.07)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1612]">
              Cobros / recargas
            </h3>
            <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#5c564e]">
              {total}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-[#7a736a]">
            Ingresos registrados en Hecom
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-[13px] text-[#7a736a]">
          Sin cobros para este cliente.
        </p>
      ) : (
        <ul className="max-h-[28rem] flex-1 overflow-y-auto">
          {rows.map((row) => {
            const fecha = formatHecomFecha(row.fecha);
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[#faf7f3]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                    {row.metodo ?? "Cobro"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#6b645c]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.codigo ? (
                      <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 font-mono text-[10px] text-[#6b645c]">
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
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.07)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1612]">
              Gastos ads
            </h3>
            <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#5c564e]">
              {total}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-[#7a736a]">
            Monto = gasto del día · “Paquete” es BM, no el spend
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-[13px] text-[#7a736a]">
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
                className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[#faf7f3]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                    {label.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#6b645c]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.fee != null ? (
                      <span className="rounded bg-[#fff1e8] px-1.5 py-0.5 text-[10px] font-semibold text-[#c45a18]">
                        Fee {row.fee}%
                      </span>
                    ) : null}
                    {label.meta ? (
                      <span className="truncate text-[11px] text-[#9a9187]">
                        {label.meta}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[#1a1612]">
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
