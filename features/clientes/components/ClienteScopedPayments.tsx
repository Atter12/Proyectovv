import { Card } from "@/components/ui/Card";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import {
  moneyUsd,
  type HecomClienteDashboard,
  type HecomCobroRow,
  type HecomGastoRow,
} from "@/lib/hecom/cliente-dashboard.server";

function formatFecha(value: string | null) {
  if (!value) return null;
  const iso = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return value;
}

/** Hecom camp often looks like: "Name 13.0 USD - Agencia|7659…|BM10" */
function parseCampLabel(camp: string | null) {
  if (!camp?.trim()) return { title: "Gasto", meta: null as string | null };

  const pipeParts = camp.split("|").map((p) => p.trim()).filter(Boolean);
  const head = pipeParts[0] ?? camp;
  const advertiserId = pipeParts[1] ?? null;
  const bmRaw = pipeParts[2] ?? null;

  const match = head.match(
    /^(.*?)\s+(\d+(?:\.\d+)?\s*USD)\s*[-–]\s*(.*)$/i,
  );

  const title = (match?.[1] ?? head).trim() || "Gasto";
  const balanceHint = match?.[2]?.replace(/\s+/g, " ").trim() ?? null;
  const tag = (match?.[3] ?? "").replace(/\s+/g, " ").trim() || null;
  const bm = bmRaw ? bmRaw.replace(/^BM\s*/i, "BM ") : null;

  const meta = [
    tag && tag.toLowerCase() !== "agencia" ? tag : tag ? "Agencia" : null,
    balanceHint,
    advertiserId
      ? `ID …${advertiserId.slice(-6)}`
      : null,
    bm,
  ].filter(Boolean);

  return { title, meta: meta.length ? meta.join(" · ") : null };
}

export function ClienteScopedPayments({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, cobros, gastos } = data;
  const recentCobros = cobros.slice(0, 12);
  const recentGastos = gastos.slice(0, 12);

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
                Cobros y gastos de este cliente en Hecom Club (no la wallet de la
                org).
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
        <CobrosPanel rows={recentCobros} total={cobros.length} />
        <GastosPanel rows={recentGastos} total={gastos.length} />
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
        <ul className="max-h-[24rem] divide-y divide-[rgb(20_18_16_/_0.05)] overflow-y-auto">
          {rows.map((row) => {
            const fecha = formatFecha(row.fecha);
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
        <h3 className="text-[13px] font-medium text-[#1a1612]">Gastos ads</h3>
        <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] tabular-nums text-[#6b645c]">
          {total}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-[13px] text-[#7a736a]">
          Sin gastos para este cliente.
        </p>
      ) : (
        <ul className="max-h-[24rem] divide-y divide-[rgb(20_18_16_/_0.05)] overflow-y-auto">
          {rows.map((row) => {
            const label = parseCampLabel(row.camp);
            const fecha = formatFecha(row.fecha ?? row.mes);
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-[#faf7f3]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-normal text-[#1a1612]">
                    {label.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#9a9187]">
                    {[
                      fecha,
                      label.meta,
                      row.fee != null ? `Fee ${row.fee}%` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
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
