import Link from "next/link";
import {
  CrmMetricCell,
  CrmMetricsStrip,
  CrmPanel,
} from "@/components/dashboard/crm-ui";
import { CobroComprobantePreview } from "@/features/clientes/components/CobroComprobantePreview.client";
import { formatHecomFecha } from "@/lib/hecom/gasto-label";
import {
  moneyUsd,
  type HecomClienteDashboard,
  type HecomCobroRow,
} from "@/lib/hecom/cliente-dashboard.server";
import { routes } from "@/config/routes";

function formatPeriodoResumen(value: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return value;
  return `${months[monthIndex]}. ${match[1]}`;
}

function formatHora(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

function formatRegisteredAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(date);
}

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user}@${domain}`;
  return `${user.slice(0, 2)}…@${domain}`;
}

export function ClienteScopedCobros({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, summary, cobros } = data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--auth-divider)] pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
            Historial Hecom
          </p>
          <h2 className="mt-1 text-[1.125rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            Lo pagado · {cliente.name}
          </h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-[var(--auth-text-muted)]">
            Cada fila es un pago registrado en Hecom: fecha, período que cubre,
            monto y comprobantes. Tocá la miniatura para ver el voucher en grande.
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
              label="Total pagado"
              value={moneyUsd(summary.cobroTotal)}
              emphasis="primary"
            />
          </div>
          <div className="bg-white">
            <CrmMetricCell
              label="Registros"
              value={String(cobros.length)}
            />
          </div>
          <div className="bg-white">
            <CrmMetricCell
              label="Saldo estimado"
              value={moneyUsd(summary.saldoEstimado)}
              hint="Pagos − (gastos + fees)"
              emphasis={summary.saldoEstimado < 0 ? "primary" : "default"}
            />
          </div>
        </div>
      </CrmMetricsStrip>

      <CrmPanel
        title="Historial de pagos"
        subtitle={`${cobros.length} registro${cobros.length === 1 ? "" : "s"} · solo lectura CRM`}
        className="overflow-hidden"
      >
        {cobros.length === 0 ? (
          <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
            Sin pagos registrados para este cliente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-[12px]">
              <thead className="border-b border-[var(--auth-divider)] bg-[var(--auth-bg)]/70 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Fecha de pago</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Cód. pago</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3">Comprobantes</th>
                  <th className="px-4 py-3">Registrado por</th>
                  <th className="px-4 py-3">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((row) => (
                  <CobroTableRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CrmPanel>
    </div>
  );
}

function CobroTableRow({ row }: { row: HecomCobroRow }) {
  const fecha = formatHecomFecha(row.fecha);
  const periodo = formatPeriodoResumen(row.periodoResumen);

  return (
    <tr className="border-b border-[var(--auth-divider)] last:border-0 hover:bg-[var(--auth-bg)]/50">
      <td className="px-4 py-3.5 font-medium text-[var(--auth-text)] sm:px-5">
        {fecha ?? "—"}
      </td>
      <td className="px-4 py-3.5 tabular-nums text-[var(--auth-text-muted)]">
        {formatHora(row.hora)}
      </td>
      <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--auth-accent)]">
        {row.codigo ?? "—"}
      </td>
      <td className="px-4 py-3.5 font-medium text-[var(--auth-accent)]">
        {periodo}
      </td>
      <td className="px-4 py-3.5 font-semibold tabular-nums text-[#1f5c40]">
        +{moneyUsd(row.monto)}
      </td>
      <td className="px-4 py-3.5 text-[var(--auth-text)]">
        {row.metodo ?? "—"}
      </td>
      <td className="px-4 py-3.5">
        {row.comprobanteUrls.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {row.comprobanteUrls.map((_, index) => (
              <CobroComprobantePreview
                key={`${row.id}-${index}`}
                cobroId={row.id}
                index={index}
                label={
                  row.comprobanteUrls.length > 1
                    ? `Comprobante ${index + 1}`
                    : "Comprobante"
                }
              />
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-[var(--auth-text-muted)]">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-[var(--auth-text-muted)]">
        {maskEmail(row.registeredBy)}
      </td>
      <td className="px-4 py-3.5 tabular-nums text-[var(--auth-text-muted)]">
        {formatRegisteredAt(row.registeredAt)}
      </td>
    </tr>
  );
}
