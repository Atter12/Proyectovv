import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
import { getAppFormatter } from "@/lib/i18n/get-app-formatter";

function formatPeriodoResumen(value: string | null, bcp47: string): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return value;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(bcp47, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatHora(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

function limaYmdFromIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * "Registrado" = created_at en Hecom. En syncs masivos (Ads Holistic)
 * varias filas comparten la misma hora → se ve raro vs fecha de pago.
 * Si el día no coincide con el pago, mostramos solo la fecha (sin reloj).
 */
function formatRegisteredAt(
  registeredAt: string | null,
  paymentFecha: string | null,
  bcp47: string,
): { label: string; title: string } {
  if (!registeredAt) {
    return { label: "—", title: "" };
  }
  const date = new Date(registeredAt);
  if (Number.isNaN(date.getTime())) {
    return { label: registeredAt, title: "" };
  }

  const payYmd = paymentFecha?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const regYmd = limaYmdFromIso(registeredAt);
  const sameDay = Boolean(payYmd && regYmd && payYmd === regYmd);

  if (sameDay) {
    return {
      label: new Intl.DateTimeFormat(bcp47, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Lima",
      }).format(date),
      title: "Momento en que quedó cargado en Hecom",
    };
  }

  // Sync / backfill: la hora del insert no es la del pago.
  return {
    label: new Intl.DateTimeFormat(bcp47, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Lima",
    }).format(date),
    title:
      "Fecha de ingreso al CRM (sync). La fecha de pago real está en la 1ª columna.",
  };
}

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user}@${domain}`;
  return `${user.slice(0, 2)}…@${domain}`;
}

export async function ClienteScopedCobros({
  data,
  showHecomDebt = false,
}: {
  data: HecomClienteDashboard;
  /** Solo staff en vista ops. Cliente / “viendo como”: no mostrar deuda. */
  showHecomDebt?: boolean;
}) {
  const t = await getTranslations("cobros");
  const { bcp47 } = await getAppFormatter();
  const { cliente, summary, cobros } = data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--auth-divider)] pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
            {t("module")}
          </p>
          <h2 className="mt-1 text-[1.125rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            {t("title", { name: cliente.name })}
          </h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-[var(--auth-text-muted)]">
            Cada fila es un pago en Hecom. La fecha de pago es la real; “Ingreso
            CRM” es cuándo se cargó al sistema (en syncs puede diferir).
          </p>
        </div>
        <Link
          href={routes.payments}
          className="text-[12px] font-semibold text-[var(--auth-accent)] hover:underline"
        >
          {t("goPayments")}
        </Link>
      </header>

      <CrmMetricsStrip>
        <div
          className={`grid grid-cols-2 gap-px bg-[var(--auth-divider)] ${
            showHecomDebt ? "sm:grid-cols-3" : "sm:grid-cols-2"
          }`}
        >
          <div className="bg-white">
            <CrmMetricCell
              label={t("totalPaid")}
              value={moneyUsd(summary.cobroTotal)}
              emphasis="primary"
            />
          </div>
          <div className="bg-white">
            <CrmMetricCell
              label={t("records")}
              value={String(cobros.length)}
            />
          </div>
          {showHecomDebt ? (
            <div className="bg-white">
              <CrmMetricCell
                label={
                  summary.saldoEstimado < 0 ? t("debt") : t("estimated")
                }
                value={moneyUsd(summary.saldoEstimado)}
                hint={t("debtHint")}
                emphasis={summary.saldoEstimado < 0 ? "primary" : "default"}
              />
            </div>
          ) : null}
        </div>
      </CrmMetricsStrip>

      <CrmPanel
        title={t("historyTitle")}
        subtitle={`${cobros.length} registro${cobros.length === 1 ? "" : "s"} · solo lectura CRM`}
        className="overflow-hidden"
      >
        {cobros.length === 0 ? (
          <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
            {t("empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-[12px]">
              <thead className="border-b border-[var(--auth-divider)] bg-[var(--auth-bg)]/70 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                <tr>
                  <th className="px-4 py-3 sm:px-5">{t("colDate")}</th>
                  <th className="px-4 py-3">{t("colTime")}</th>
                  <th className="px-4 py-3">{t("colCode")}</th>
                  <th className="px-4 py-3">{t("colPeriod")}</th>
                  <th className="px-4 py-3">{t("colAmount")}</th>
                  <th className="px-4 py-3">{t("colMethod")}</th>
                  <th className="px-4 py-3">{t("colProofs")}</th>
                  <th className="px-4 py-3">{t("colRegisteredBy")}</th>
                  <th className="px-4 py-3">{t("colCrmIn")}</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((row) => (
                  <CobroTableRow key={row.id} row={row} bcp47={bcp47} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CrmPanel>
    </div>
  );
}

function CobroTableRow({
  row,
  bcp47,
}: {
  row: HecomCobroRow;
  bcp47: string;
}) {
  const fecha = formatHecomFecha(row.fecha);
  const periodo = formatPeriodoResumen(row.periodoResumen, bcp47);
  const registered = formatRegisteredAt(row.registeredAt, row.fecha, bcp47);

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
      <td
        className="px-4 py-3.5 tabular-nums text-[var(--auth-text-muted)]"
        title={registered.title || undefined}
      >
        {registered.label}
      </td>
    </tr>
  );
}
