"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker.client";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { formatHecomFecha } from "@/lib/hecom/gasto-label";
import {
  filterGastosByDateRange,
  getGastosDateBounds,
  shiftYmd,
  sortGastosByDateDesc,
  todayYmdInTz,
} from "@/lib/hecom/gasto-date";
import { moneyUsd } from "@/lib/format/money-usd";
import type { HecomGastoRow } from "@/lib/hecom/cliente-finance.types";

function defaultRange(bounds: { min: string | null; max: string | null }) {
  if (bounds.min && bounds.max) {
    return { start: bounds.min, end: bounds.max };
  }
  const today = todayYmdInTz();
  return { start: shiftYmd(today, -29), end: today };
}

function sumGastos(rows: HecomGastoRow[]) {
  return Math.round(rows.reduce((sum, row) => sum + row.gasto, 0) * 100) / 100;
}

/** Agrupa filas Hecom por día y suma (sin campaña / BM). */
function totalsByDay(rows: HecomGastoRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.fecha?.slice(0, 10) ?? row.mes?.slice(0, 10) ?? "sin-fecha";
    map.set(key, Math.round(((map.get(key) ?? 0) + row.gasto) * 100) / 100);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, total]) => ({ dateKey, total }));
}

function formatRangeLabel(start: string, end: string) {
  const a = formatHecomFecha(start);
  const b = formatHecomFecha(end);
  if (a && b) return `${a} – ${b}`;
  return `${start} – ${end}`;
}

export function GastosAdsLedger({
  gastos,
  title = "Gastos",
  subtitle = "Total del período · solo lectura Hecom",
}: {
  gastos: HecomGastoRow[];
  accounts?: unknown;
  title?: string;
  subtitle?: string;
}) {
  const searchParams = useSearchParams();
  const urlStart = searchParams.get("start")?.trim() || null;
  const urlEnd = searchParams.get("end")?.trim() || null;

  const sorted = useMemo(() => sortGastosByDateDesc(gastos), [gastos]);
  const bounds = useMemo(() => getGastosDateBounds(sorted), [sorted]);
  const initialRange = useMemo(() => {
    if (urlStart && urlEnd) return { start: urlStart, end: urlEnd };
    return defaultRange(bounds);
  }, [bounds, urlEnd, urlStart]);

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const calendarMax = todayYmdInTz();

  useEffect(() => {
    if (urlStart) setStartDate(urlStart);
    if (urlEnd) setEndDate(urlEnd);
  }, [urlEnd, urlStart]);

  useEffect(() => {
    if (!bounds.max) return;
    setEndDate((prev) => (bounds.max! > prev ? bounds.max! : prev));
  }, [bounds.max]);

  const filtered = useMemo(
    () => filterGastosByDateRange(sorted, startDate, endDate),
    [sorted, startDate, endDate],
  );

  const periodTotal = useMemo(() => sumGastos(filtered), [filtered]);
  const dailyTotals = useMemo(() => totalsByDay(filtered), [filtered]);
  const dayCount = dailyTotals.filter((d) => d.dateKey !== "sin-fecha").length;

  function handleRangeChange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  return (
    <CrmPanel
      title={title}
      subtitle={`${subtitle} · ${formatRangeLabel(startDate, endDate)}`}
      className="flex h-full flex-col"
    >
      {sorted.length > 0 ? (
        <div className="border-b border-[var(--auth-divider)] px-4 py-4 sm:px-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
            Rango de fechas
          </p>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleRangeChange}
            minDate={bounds.min}
            maxDate={calendarMax}
            className="w-full max-w-full sm:max-w-[300px]"
          />
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <p className="px-4 py-10 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
          Sin gastos registrados para este cliente.
        </p>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-[13px] font-medium text-[var(--auth-text)]">
            No hay gastos en este rango
          </p>
          <p className="mt-1 text-[12px] text-[var(--auth-text-muted)]">
            Probá ampliar las fechas con el selector de arriba.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-[var(--auth-divider)] px-4 py-6 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
              Gasto total del período
            </p>
            <p className="mt-2 text-[2.25rem] font-bold leading-none tracking-[-0.04em] tabular-nums text-[var(--auth-text)] sm:text-[2.75rem]">
              {moneyUsd(periodTotal)}
            </p>
            <p className="mt-2 text-[12px] text-[var(--auth-text-muted)]">
              {dayCount > 0
                ? `${dayCount} día${dayCount === 1 ? "" : "s"} con actividad`
                : "Sin desglose por día"}
              {" · "}
              {formatRangeLabel(startDate, endDate)}
            </p>
          </div>

          {dailyTotals.length > 1 ? (
            <ul className="max-h-[24rem] flex-1 divide-y divide-[var(--auth-divider)] overflow-y-auto">
              {dailyTotals.map(({ dateKey, total }) => {
                const label =
                  dateKey === "sin-fecha"
                    ? "Sin fecha"
                    : (formatHecomFecha(dateKey) ?? dateKey);
                return (
                  <li
                    key={dateKey}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                  >
                    <span className="text-[13px] font-medium text-[var(--auth-text)]">
                      {label}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--auth-text)]">
                      {moneyUsd(total)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </CrmPanel>
  );
}
