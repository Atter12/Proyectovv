"use client";

import { useMemo, useState } from "react";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker.client";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import {
  formatHecomFecha,
  formatHecomGastoDisplay,
} from "@/lib/hecom/gasto-label";
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

export function GastosAdsLedger({
  gastos,
  title = "Gastos ads",
  subtitle = "Consumo del día · “Paquete” es BM",
}: {
  gastos: HecomGastoRow[];
  title?: string;
  subtitle?: string;
}) {
  const sorted = useMemo(() => sortGastosByDateDesc(gastos), [gastos]);
  const bounds = useMemo(() => getGastosDateBounds(sorted), [sorted]);
  const initialRange = useMemo(() => defaultRange(bounds), [bounds]);

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  const filtered = useMemo(
    () => filterGastosByDateRange(sorted, startDate, endDate),
    [sorted, startDate, endDate],
  );

  const periodTotal = useMemo(
    () =>
      Math.round(filtered.reduce((sum, row) => sum + row.gasto, 0) * 100) / 100,
    [filtered],
  );

  function handleRangeChange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  const panelSubtitle = `${subtitle} · ${filtered.length} de ${sorted.length} registro${
    sorted.length === 1 ? "" : "s"
  } · ${moneyUsd(periodTotal)} en el período`;

  return (
    <CrmPanel
      title={title}
      subtitle={panelSubtitle}
      className="flex h-full flex-col overflow-hidden [&>div:first-child]:overflow-visible"
      action={
        sorted.length > 0 ? (
          <div className="relative z-30 w-full min-w-[220px] sm:w-[248px]">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleRangeChange}
              minDate={bounds.min}
              maxDate={bounds.max ?? todayYmdInTz()}
            />
          </div>
        ) : null
      }
    >
      {sorted.length === 0 ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5">
          Sin gastos para este cliente.
        </p>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-[13px] font-medium text-[var(--auth-text)]">
            No hay gastos en este rango
          </p>
          <p className="mt-1 text-[12px] text-[var(--auth-text-muted)]">
            Probá ampliar las fechas o elegí un preset de 7, 14 o 30 días.
          </p>
        </div>
      ) : (
        <ul className="max-h-[32rem] flex-1 overflow-y-auto">
          {filtered.map((row) => {
            const fecha = formatHecomFecha(row.fecha ?? row.mes);
            const label = formatHecomGastoDisplay(row.camp, {
              notas: row.notas,
              fee: null,
              fecha: null,
            });
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 last:border-0 hover:bg-[var(--auth-bg)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                    {label.title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--auth-text-muted)]">
                        {fecha}
                      </span>
                    ) : null}
                    {row.fee != null ? (
                      <span className="rounded bg-[var(--auth-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--auth-accent)]">
                        Fee {row.fee}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--auth-text)]">
                  {moneyUsd(row.gasto)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </CrmPanel>
  );
}
