"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CobrosPaymentHistory,
  type CobroHistoryRow,
} from "@/features/clientes/components/CobrosPaymentHistory.client";
import {
  VoucherAccountStatement,
  type StatementCobro,
  type StatementGasto,
} from "@/features/clientes/components/VoucherAccountStatement.client";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";

function limaMonthKey(): string {
  return todayYmdInTz("America/Lima").slice(0, 7);
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

function formatMonthShort(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function ymdMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  const periodo = raw.match(/^(\d{4}-\d{2})/);
  return periodo ? periodo[1] : null;
}

type Props = {
  gastos: StatementGasto[];
  cobros: StatementCobro[];
  historyCobros: CobroHistoryRow[];
  feePercent: number;
  capped: boolean;
};

/**
 * Mes compartido: picker arriba → gráfica Cuánto debes + historial de pagos.
 */
export function ClienteCobrosMonthView({
  gastos,
  cobros,
  historyCobros,
  feePercent,
  capped,
}: Props) {
  const t = useTranslations("cobros");
  const locale = useLocale();
  const currentMonth = useMemo(() => limaMonthKey(), []);
  const [month, setMonth] = useState(currentMonth);

  const oldestMonth = useMemo(() => {
    let min = currentMonth;
    for (const row of gastos) {
      const key = ymdMonth(row.fecha);
      if (key && key < min) min = key;
    }
    for (const row of cobros) {
      const key = ymdMonth(row.periodoResumen) || ymdMonth(row.fecha);
      if (key && key < min) min = key;
    }
    for (const row of historyCobros) {
      const key = ymdMonth(row.periodoResumen) || ymdMonth(row.fecha);
      if (key && key < min) min = key;
    }
    return min;
  }, [cobros, currentMonth, gastos, historyCobros]);

  const recentMonths = useMemo(() => {
    const list: string[] = [];
    let cur = currentMonth;
    for (let i = 0; i < 6; i++) {
      if (cur < oldestMonth) break;
      list.push(cur);
      cur = shiftMonthKey(cur, -1);
    }
    return list;
  }, [currentMonth, oldestMonth]);

  const canPrev = shiftMonthKey(month, -1) >= oldestMonth;
  const canNext = month < currentMonth;
  const isCurrent = month === currentMonth;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[#ffd7b8] bg-[linear-gradient(165deg,#fffaf6_0%,#ffffff_55%,#fff7f0_100%)] shadow-[0_14px_36px_-28px_rgb(255_120_31_/_0.5)]">
        <div className="flex flex-col gap-3 border-b border-[#ffe4cc] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#c2410c]">
              {t("monthScopeEyebrow")}
            </p>
            <p className="mt-0.5 text-[12px] leading-4 text-[#6b645c]">
              {t("monthScopeHint")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isCurrent ? (
              <button
                type="button"
                onClick={() => setMonth(currentMonth)}
                className="h-10 rounded-xl border border-[#ffd7b8] bg-white px-3 text-[12px] font-semibold text-[#c2410c] transition hover:bg-[#fff7f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d47840]"
              >
                {t("jumpCurrentMonth")}
              </button>
            ) : null}

            <div className="flex items-center rounded-xl border border-[#ffd7b8] bg-white p-1 shadow-[0_1px_0_rgb(255_215_184_/_0.6)]">
              <button
                type="button"
                aria-label={t("prevMonth")}
                disabled={!canPrev}
                onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-[#fff7f0] hover:text-[#1c1917] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d47840] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
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
              <div className="min-w-[10rem] px-2 text-center sm:min-w-[12rem]">
                <p className="text-[14px] font-semibold capitalize tracking-[-0.02em] text-[#1c1917]">
                  {formatMonthTitle(month, locale)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#c2410c]">
                  {isCurrent ? t("thisMonth") : t("monthScopeSynced")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("nextMonth")}
                disabled={!canNext}
                onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-[#fff7f0] hover:text-[#1c1917] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d47840] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
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
        </div>

        {recentMonths.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto border-b border-[#ffe8d4] bg-[#fffaf6]/80 px-3 py-2 sm:px-4">
            {recentMonths.map((ym) => {
              const active = ym === month;
              return (
                <button
                  key={ym}
                  type="button"
                  onClick={() => setMonth(ym)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d47840] ${
                    active
                      ? "bg-[#d47840] text-white"
                      : "text-[#6b645c] hover:bg-white hover:text-[#1c1917]"
                  }`}
                  aria-pressed={active}
                >
                  {formatMonthShort(ym, locale)}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="p-3 sm:p-4">
          <VoucherAccountStatement
            monthYm={month}
            feePercent={feePercent}
            capped={capped}
            gastos={gastos}
            cobros={cobros}
            embedded
          />
        </div>
      </div>

      <CobrosPaymentHistory
        cobros={historyCobros}
        month={month}
        onMonthChange={setMonth}
        hideMonthPicker
      />
    </div>
  );
}
