"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CobroComprobantePreview } from "@/features/clientes/components/CobroComprobantePreview.client";
import { moneyUsd } from "@/lib/format/money-usd";

export type CobroHistoryRow = {
  id: string;
  fecha: string | null;
  hora: string | null;
  codigo: string | null;
  periodoResumen: string | null;
  monto: number;
  metodo: string | null;
  comprobanteUrls: string[];
  registeredBy: string | null;
  registeredAt: string | null;
};

function limaMonthKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

function shiftMonthKey(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function formatMonthTitle(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function cobroMonthKey(row: CobroHistoryRow): string | null {
  // Igual que Hecom Club / Ajustar: manda periodo_resumen sobre fecha de pago.
  const periodo = row.periodoResumen?.trim() ?? "";
  const fromPeriodo = periodo.match(/^(\d{4}-\d{2})/);
  if (fromPeriodo) return fromPeriodo[1];
  const fecha = row.fecha?.trim().slice(0, 10) ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha.slice(0, 7);
  return null;
}

function formatHecomFecha(value: string | null, locale: string): string {
  if (!value) return "—";
  const iso = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function formatPeriodoResumen(value: string | null, locale: string): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
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

function formatRegisteredAt(
  registeredAt: string | null,
  paymentFecha: string | null,
  locale: string,
): { label: string; title: string } {
  if (!registeredAt) return { label: "—", title: "" };
  const date = new Date(registeredAt);
  if (Number.isNaN(date.getTime())) {
    return { label: registeredAt, title: "" };
  }
  const payYmd = paymentFecha?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const regYmd = limaYmdFromIso(registeredAt);
  const sameDay = Boolean(payYmd && regYmd && payYmd === regYmd);
  if (sameDay) {
    return {
      label: new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Lima",
      }).format(date),
      title: "",
    };
  }
  return {
    label: new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Lima",
    }).format(date),
    title: "",
  };
}

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user}@${domain}`;
  return `${user.slice(0, 2)}…@${domain}`;
}

export function CobrosPaymentHistory({ cobros }: { cobros: CobroHistoryRow[] }) {
  const t = useTranslations("cobros");
  const locale = useLocale();
  const currentMonth = useMemo(() => limaMonthKey(), []);
  const [month, setMonth] = useState(currentMonth);

  const oldestMonth = useMemo(() => {
    let min: string | null = null;
    for (const row of cobros) {
      const key = cobroMonthKey(row);
      if (!key) continue;
      if (!min || key < min) min = key;
    }
    return min;
  }, [cobros]);

  const filtered = useMemo(
    () =>
      cobros.filter((row) => {
        const key = cobroMonthKey(row);
        return key === month;
      }),
    [cobros, month],
  );

  const monthTotal = useMemo(
    () =>
      Math.round(filtered.reduce((sum, row) => sum + Number(row.monto || 0), 0) * 100) /
      100,
    [filtered],
  );

  const canPrev = Boolean(oldestMonth && shiftMonthKey(month, -1) >= oldestMonth);
  const canNext = month < currentMonth;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--auth-divider)] bg-white shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 border-b border-[var(--auth-divider)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
            {t("historyTitle")}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--auth-text-muted)]">
            {t("historyMonthHint", {
              count: filtered.length,
              total: moneyUsd(monthTotal),
            })}
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-xl border border-[#ece7e0] bg-[#faf8f5] p-1 sm:self-auto">
          <button
            type="button"
            aria-label={t("prevMonth")}
            disabled={!canPrev}
            onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-white hover:text-[#1c1917] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="min-w-[9.5rem] px-2 text-center sm:min-w-[11rem]">
            <p className="text-[13px] font-semibold capitalize tracking-[-0.01em] text-[#1c1917]">
              {formatMonthTitle(month, locale)}
            </p>
            {month === currentMonth ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-accent)]">
                {t("thisMonth")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={t("nextMonth")}
            disabled={!canNext}
            onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-white hover:text-[#1c1917] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M7.5 4.5 13 10l-5.5 5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
          {t("emptyMonth")}
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
              {filtered.map((row) => {
                const registered = formatRegisteredAt(
                  row.registeredAt,
                  row.fecha,
                  locale,
                );
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--auth-divider)] last:border-0 hover:bg-[var(--auth-bg)]/50"
                  >
                    <td className="px-4 py-3.5 font-medium text-[var(--auth-text)] sm:px-5">
                      {formatHecomFecha(row.fecha, locale)}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-[var(--auth-text-muted)]">
                      {formatHora(row.hora)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--auth-accent)]">
                      {row.codigo ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[var(--auth-accent)]">
                      {formatPeriodoResumen(row.periodoResumen, locale)}
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
                                  ? t("proofN", { n: index + 1 })
                                  : t("proof")
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--auth-text-muted)]">
                          —
                        </span>
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
