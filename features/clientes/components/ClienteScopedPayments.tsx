import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/routes";
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
  // API already caps at 80; show all loaded rows (scrollable)
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
      <section className="overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
        <div className="relative px-5 py-5 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgb(255_120_31_/_0.05),transparent)]"
          />
          <div className="relative flex min-w-0 items-start gap-3">
            <HecomClienteAvatar
              name={cliente.name}
              avatarUrl={cliente.avatarUrl}
              size="md"
              className="ring-1 ring-white shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a5a38]">
                Pagos · Hecom
              </p>
              <h2 className="mt-1 text-[1.25rem] font-medium tracking-[-0.015em] text-[#1a1612] sm:text-[1.35rem]">
                Movimientos de {cliente.name}
              </h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
                Historial CRM (cobros y gasto ads). No es la wallet Holistic: el
                dinero nuevo se recarga arriba con Stripe y se asigna a{" "}
                <Link
                  href={routes.adAccounts}
                  className="font-medium text-[#c45a18] underline-offset-2 hover:underline"
                >
                  cuentas publicitarias
                </Link>
                , no por campaña.
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
                <p className="pl-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
                  {kpi.label}
                </p>
                <p
                  className={`mt-1 truncate pl-2 text-[1.2rem] font-medium tracking-[-0.015em] tabular-nums ${kpi.tone}`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
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
    <Card className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-0 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-3.5">
        <h3 className="text-[13px] font-medium text-[#1a1612]">
          Cobros / recargas
        </h3>
        <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] tabular-nums text-[#6b645c]">
          {total}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-[13px] text-[#7a736a]">
          Sin cobros para este cliente.
        </p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-[rgb(20_18_16_/_0.05)] overflow-y-auto">
          {rows.map((row) => {
            const fecha = formatHecomFecha(row.fecha);
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-[#faf7f3]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-normal text-[#1a1612]">
                    {row.metodo ?? "Cobro"}
                    {fecha ? (
                      <span className="text-[#7a736a]"> · {fecha}</span>
                    ) : null}
                  </p>
                  {row.codigo ? (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-[#9a9187]">
                      {row.codigo}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-[13px] font-medium tabular-nums text-[#1f5c40]">
                  {moneyUsd(row.monto)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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
    <Card className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-0 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-3.5">
        <div>
          <h3 className="text-[13px] font-medium text-[#1a1612]">Gastos ads</h3>
          <p className="text-[11px] text-[#9a9187]">
            Monto = gasto del día · “Paquete” es BM, no el spend
          </p>
        </div>
        <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] tabular-nums text-[#6b645c]">
          {total}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-[13px] text-[#7a736a]">
          Sin gastos para este cliente.
        </p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-[rgb(20_18_16_/_0.05)] overflow-y-auto">
          {rows.map((row) => {
            const label = formatHecomGastoDisplay(row.camp, {
              notas: row.notas,
              fee: row.fee,
              fecha: formatHecomFecha(row.fecha ?? row.mes),
            });
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-[#faf7f3]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-normal text-[#1a1612]">
                    {label.title}
                  </p>
                  {label.meta ? (
                    <p className="mt-0.5 truncate text-[11px] text-[#9a9187]">
                      {label.meta}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-[13px] font-medium tabular-nums text-[#1a1612]">
                  {moneyUsd(row.gasto)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
