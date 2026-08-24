"use client";

import { useMemo, useState } from "react";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker.client";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { formatBmBucketLabel } from "@/lib/hecom/bm-label";
import {
  formatHecomFecha,
  formatHecomGastoDisplay,
  resolveBmForGasto,
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
import type { HecomTiktokAccount } from "@/lib/hecom/clientes.server";

const ALL_BMS = "__all_bms__";

function defaultRange(bounds: { min: string | null; max: string | null }) {
  if (bounds.min && bounds.max) {
    return { start: bounds.min, end: bounds.max };
  }
  const today = todayYmdInTz();
  return { start: shiftYmd(today, -29), end: today };
}

function bmMapFromAccounts(
  accounts: HecomTiktokAccount[] | undefined,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const account of accounts ?? []) {
    map.set(account.advertiserId, formatBmBucketLabel(account.bmBucket));
  }
  return map;
}

function listUniqueBmsFromGastos(
  gastos: HecomGastoRow[],
  bmByAdvertiser: Map<string, string | null>,
): string[] {
  const set = new Set<string>();
  for (const row of gastos) {
    const bm = resolveBmForGasto(row, bmByAdvertiser);
    if (bm?.trim()) set.add(bm.trim());
  }
  return [...set].sort((a, b) => {
    const na = Number(a.replace(/\D/g, ""));
    const nb = Number(b.replace(/\D/g, ""));
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}

function sumGastos(rows: HecomGastoRow[]) {
  return Math.round(rows.reduce((sum, row) => sum + row.gasto, 0) * 100) / 100;
}

export function GastosAdsLedger({
  gastos,
  accounts,
  title = "Gastos ads",
  subtitle = "Consumo del día · filtrá por BM y fecha",
}: {
  gastos: HecomGastoRow[];
  accounts?: HecomTiktokAccount[];
  title?: string;
  subtitle?: string;
}) {
  const sorted = useMemo(() => sortGastosByDateDesc(gastos), [gastos]);
  const bounds = useMemo(() => getGastosDateBounds(sorted), [sorted]);
  const initialRange = useMemo(() => defaultRange(bounds), [bounds]);
  const bmByAdvertiser = useMemo(
    () => bmMapFromAccounts(accounts),
    [accounts],
  );
  const bms = useMemo(
    () => listUniqueBmsFromGastos(sorted, bmByAdvertiser),
    [sorted, bmByAdvertiser],
  );

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedBm, setSelectedBm] = useState(ALL_BMS);

  const dateFiltered = useMemo(
    () => filterGastosByDateRange(sorted, startDate, endDate),
    [sorted, startDate, endDate],
  );

  const filtered = useMemo(() => {
    if (selectedBm === ALL_BMS) return dateFiltered;
    return dateFiltered.filter(
      (row) => resolveBmForGasto(row, bmByAdvertiser) === selectedBm,
    );
  }, [dateFiltered, selectedBm, bmByAdvertiser]);

  const periodTotal = useMemo(() => sumGastos(filtered), [filtered]);
  const periodTotalAll = useMemo(() => sumGastos(dateFiltered), [dateFiltered]);

  const bmTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of dateFiltered) {
      const bm = resolveBmForGasto(row, bmByAdvertiser) ?? "Sin BM";
      totals.set(bm, Math.round(((totals.get(bm) ?? 0) + row.gasto) * 100) / 100);
    }
    return [...totals.entries()]
      .map(([bm, total]) => ({ bm, total }))
      .sort((a, b) => {
        if (a.bm === "Sin BM") return 1;
        if (b.bm === "Sin BM") return -1;
        const na = Number(a.bm.replace(/\D/g, ""));
        const nb = Number(b.bm.replace(/\D/g, ""));
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return b.total - a.total;
      });
  }, [dateFiltered, bmByAdvertiser]);

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
      className="flex h-full flex-col"
    >
      {sorted.length > 0 ? (
        <div className="space-y-3 border-b border-[var(--auth-divider)] px-4 py-3 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                Business Manager
              </p>
              <select
                value={selectedBm}
                onChange={(e) => setSelectedBm(e.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--auth-divider)] bg-white px-3 text-[13px] font-medium text-[var(--auth-text)] outline-none focus:border-[var(--auth-accent)]"
              >
                <option value={ALL_BMS}>
                  Todas las BM ({moneyUsd(periodTotalAll)})
                </option>
                {bms.map((bm) => {
                  const total = sumGastos(
                    dateFiltered.filter(
                      (row) => resolveBmForGasto(row, bmByAdvertiser) === bm,
                    ),
                  );
                  return (
                    <option key={bm} value={bm}>
                      {bm} · {moneyUsd(total)}
                    </option>
                  );
                })}
              </select>
            </label>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                Filtrar por fecha
              </p>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={handleRangeChange}
                minDate={bounds.min}
                maxDate={bounds.max ?? todayYmdInTz()}
                className="w-full max-w-full sm:max-w-[280px]"
              />
            </div>
          </div>

          {bmTotals.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {bmTotals.map(({ bm, total }) => (
                <button
                  key={bm}
                  type="button"
                  onClick={() =>
                    setSelectedBm(bm === "Sin BM" ? ALL_BMS : bm)
                  }
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                    selectedBm === bm ||
                    (selectedBm === ALL_BMS && bmTotals.length === 1)
                      ? "bg-[var(--auth-accent-soft)] text-[var(--auth-accent)] ring-1 ring-[var(--auth-accent)]/30"
                      : "bg-[var(--auth-bg)] text-[var(--auth-text-muted)] hover:bg-[var(--auth-accent-soft)]/60"
                  }`}
                >
                  {bm} · {moneyUsd(total)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
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
            Probá otra BM, ampliar las fechas o elegí un preset de 7, 14 o 30 días.
          </p>
        </div>
      ) : (
        <ul className="max-h-[32rem] flex-1 overflow-y-auto">
          {filtered.map((row) => {
            const fecha = formatHecomFecha(row.fecha ?? row.mes);
            const bm = resolveBmForGasto(row, bmByAdvertiser);
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
                  {label.meta ? (
                    <p className="mt-0.5 truncate text-[11px] text-[var(--auth-text-muted)]">
                      {label.meta}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {fecha ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--auth-text-muted)]">
                        {fecha}
                      </span>
                    ) : null}
                    {bm ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--auth-text)]">
                        {bm}
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
