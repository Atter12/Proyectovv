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

export function CobrosPaymentHistory({
  cobros,
  month: monthProp,
  onMonthChange,
  hideMonthPicker = false,
  hideStaff = false,
  proofEndpoint,
}: {
  cobros: CobroHistoryRow[];
  /** Mes controlado desde afuera (`YYYY-MM`). */
  month?: string;
  onMonthChange?: (ym: string) => void;
  /** Oculta el selector (cuando ya hay uno arriba). */
  hideMonthPicker?: boolean;
  /** Link público: oculta quién registró el cobro. */
  hideStaff?: boolean;
  /** GET del comprobante. En el link público reemplaza la ruta de staff. */
  proofEndpoint?: (cobroId: string, index: number) => string;
}) {
  const t = useTranslations("cobros");
  const locale = useLocale();
  const currentMonth = useMemo(() => limaMonthKey(), []);
  const [internalMonth, setInternalMonth] = useState(currentMonth);
  const controlled = typeof monthProp === "string" && /^\d{4}-\d{2}$/.test(monthProp);
  const month = controlled ? monthProp : internalMonth;
  const setMonth = (next: string | ((prev: string) => string)) => {
    const value = typeof next === "function" ? next(month) : next;
    if (!controlled) setInternalMonth(value);
    onMonthChange?.(value);
  };

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
  const showProofs = !hideStaff || Boolean(proofEndpoint);

  return (
    <section className="overflow-hidden rounded-[24px] bg-white ring-1 ring-[#e8dfd4]">
      <div className="flex flex-col gap-3 border-b border-[#efe8df] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1714]">
            {t("historyTitle")}
          </h3>
          <p className="mt-0.5 text-[12px] text-[#5c564e]">
            {t("historyMonthHint", {
              count: filtered.length,
              total: moneyUsd(monthTotal),
            })}
          </p>
          {hideMonthPicker ? (
            <p className="mt-1 text-[11px] text-[#8a8177]">
              {t("historySyncedMonth", {
                month: formatMonthTitle(month, locale),
              })}
            </p>
          ) : null}
        </div>

        {hideMonthPicker ? null : (
          <div className="flex items-center gap-1 self-start rounded-full border border-[#e8dfd4] bg-[#faf8f5] p-1 sm:self-auto">
            <button
              type="button"
              aria-label={t("prevMonth")}
              disabled={!canPrev}
              onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5c564e] transition hover:bg-white hover:text-[#1a1714] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
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
              <p className="text-[13px] font-semibold capitalize tracking-[-0.01em] text-[#1a1714]">
                {formatMonthTitle(month, locale)}
              </p>
              {month === currentMonth ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a6b4a]">
                  {t("thisMonth")}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t("nextMonth")}
              disabled={!canNext}
              onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5c564e] transition hover:bg-white hover:text-[#1a1714] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
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
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-10 sm:px-5">
          <p className="rounded-2xl bg-[#fcfaf7] px-4 py-8 text-center text-[13px] font-medium text-[#5c564e]">
            {t("emptyMonth")}
          </p>
        </div>
      ) : (
        <>
        <ul className="divide-y divide-[#f3eee8] md:hidden">
          {filtered.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ecf7ef] text-[#1f6b3a]"
                  aria-hidden
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                    <path
                      d="m5 10.5 3.2 3L15 6.5"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#1a1714]">
                    {row.metodo ?? "—"}
                  </p>
                  <p className="text-[11px] tabular-nums text-[#8a8177]">
                    {formatHecomFecha(row.fecha, locale)}
                    {row.hora ? ` · ${formatHora(row.hora)}` : ""}
                  </p>
                  {row.codigo ? (
                    <p className="truncate font-mono text-[10px] text-[#9a6b4a]">{row.codigo}</p>
                  ) : null}
                  {showProofs && row.comprobanteUrls.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {row.comprobanteUrls.map((_, index) => (
                        <CobroComprobantePreview
                          key={`${row.id}-m-${index}`}
                          cobroId={row.id}
                          index={index}
                          endpoint={proofEndpoint?.(row.id, index)}
                          label={
                            row.comprobanteUrls.length > 1
                              ? t("proofN", { n: index + 1 })
                              : t("proof")
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-semibold tabular-nums text-[#1f5c40]">
                  +{moneyUsd(row.monto)}
                </p>
                <p className="mt-0.5 text-[10px] capitalize text-[#8a8177]">
                  {formatPeriodoResumen(row.periodoResumen, locale)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[920px] w-full text-left text-[12px]">
            <thead className="border-b border-[#efe8df] bg-[#fcfaf7] text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a8177]">
              <tr>
                <th className="px-4 py-3 sm:px-5">{t("colDate")}</th>
                <th className="px-4 py-3">{t("colTime")}</th>
                <th className="px-4 py-3">{t("colCode")}</th>
                <th className="px-4 py-3">{t("colPeriod")}</th>
                <th className="px-4 py-3">{t("colAmount")}</th>
                <th className="px-4 py-3">{t("colMethod")}</th>
                {showProofs ? (
                  <th className="px-4 py-3">{t("colProofs")}</th>
                ) : null}
                {hideStaff ? null : (
                  <th className="px-4 py-3">{t("colRegisteredBy")}</th>
                )}
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
                    className="border-b border-[#f3eee8] last:border-0 transition hover:bg-[#fcfaf7]"
                  >
                    <td className="px-4 py-3.5 font-medium text-[var(--auth-text)] sm:px-5">
                      {formatHecomFecha(row.fecha, locale)}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-[var(--auth-text-muted)]">
                      {formatHora(row.hora)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[#9a6b4a]">
                      {row.codigo ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 font-medium capitalize text-[var(--auth-accent)]">
                      {formatPeriodoResumen(row.periodoResumen, locale)}
                    </td>
                    <td className="px-4 py-3.5 font-semibold tabular-nums text-[#1f5c40]">
                      +{moneyUsd(row.monto)}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--auth-text)]">
                      {row.metodo ?? "—"}
                    </td>
                    {showProofs ? (
                    <td className="px-4 py-3.5">
                      {row.comprobanteUrls.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {row.comprobanteUrls.map((_, index) => (
                            <CobroComprobantePreview
                              key={`${row.id}-${index}`}
                              cobroId={row.id}
                              index={index}
                              endpoint={proofEndpoint?.(row.id, index)}
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
                    ) : null}
                    {hideStaff ? null : (
                    <td className="px-4 py-3.5 text-[var(--auth-text-muted)]">
                      {maskEmail(row.registeredBy)}
                    </td>
                    )}
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
        </>
      )}
    </section>
  );
}
