"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker.client";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { formatBmBucketLabel } from "@/lib/hecom/bm-bucket.shared";
import {
  formatHecomFecha,
  formatHecomGastoDisplay,
  getAdvertiserIdFromCamp,
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
const ALL_ADVERTISERS = "__all_advertisers__";

function normalizeBmParam(value: string | null): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim().replace(/^BM\s*/i, "");
  return raw ? `BM ${raw}` : null;
}

function groupGastosByDate(rows: HecomGastoRow[]) {
  const groups = new Map<string, HecomGastoRow[]>();
  for (const row of rows) {
    const key = row.fecha?.slice(0, 10) ?? row.mes?.slice(0, 10) ?? "sin-fecha";
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

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
  const searchParams = useSearchParams();
  const urlAdvertiser = searchParams.get("advertiser")?.trim() || null;
  const urlBm = normalizeBmParam(searchParams.get("bm"));
  const urlStart = searchParams.get("start")?.trim() || null;
  const urlEnd = searchParams.get("end")?.trim() || null;

  const sorted = useMemo(() => sortGastosByDateDesc(gastos), [gastos]);
  const bounds = useMemo(() => getGastosDateBounds(sorted), [sorted]);
  const initialRange = useMemo(() => {
    if (urlStart && urlEnd) return { start: urlStart, end: urlEnd };
    return defaultRange(bounds);
  }, [bounds, urlEnd, urlStart]);
  const bmByAdvertiser = useMemo(
    () => bmMapFromAccounts(accounts),
    [accounts],
  );
  const bms = useMemo(
    () => listUniqueBmsFromGastos(sorted, bmByAdvertiser),
    [sorted, bmByAdvertiser],
  );
  const advertiserOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts ?? []) {
      if (account.advertiserId) {
        map.set(
          account.advertiserId,
          account.advertiserName?.trim() || account.advertiserId,
        );
      }
    }
    for (const row of sorted) {
      const id = getAdvertiserIdFromCamp(row.camp);
      if (!id || map.has(id)) continue;
      const label = formatHecomGastoDisplay(row.camp, { notas: row.notas }).title;
      map.set(id, label);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [accounts, sorted]);

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedBm, setSelectedBm] = useState(urlBm ?? ALL_BMS);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState(
    urlAdvertiser ?? ALL_ADVERTISERS,
  );

  useEffect(() => {
    if (urlStart) setStartDate(urlStart);
    if (urlEnd) setEndDate(urlEnd);
    if (urlBm) setSelectedBm(urlBm);
    if (urlAdvertiser) setSelectedAdvertiser(urlAdvertiser);
  }, [urlAdvertiser, urlBm, urlEnd, urlStart]);

  const calendarMax = todayYmdInTz();

  useEffect(() => {
    if (!bounds.max) return;
    setEndDate((prev) => (bounds.max! > prev ? bounds.max! : prev));
  }, [bounds.max]);

  const dateFiltered = useMemo(
    () => filterGastosByDateRange(sorted, startDate, endDate),
    [sorted, startDate, endDate],
  );

  const filtered = useMemo(() => {
    let rows = dateFiltered;
    if (selectedBm !== ALL_BMS) {
      rows = rows.filter(
        (row) => resolveBmForGasto(row, bmByAdvertiser) === selectedBm,
      );
    }
    if (selectedAdvertiser !== ALL_ADVERTISERS) {
      rows = rows.filter(
        (row) => getAdvertiserIdFromCamp(row.camp) === selectedAdvertiser,
      );
    }
    return rows;
  }, [dateFiltered, selectedBm, selectedAdvertiser, bmByAdvertiser]);

  const grouped = useMemo(() => groupGastosByDate(filtered), [filtered]);
  const selectedAdvertiserLabel =
    advertiserOptions.find((item) => item.id === selectedAdvertiser)?.name ??
    null;

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

  const panelSubtitle = selectedAdvertiserLabel
    ? `${selectedAdvertiserLabel} · ${filtered.length} registro${
        filtered.length === 1 ? "" : "s"
      } · ${moneyUsd(periodTotal)} en el período`
    : `${subtitle} · ${filtered.length} de ${sorted.length} registro${
        sorted.length === 1 ? "" : "s"
      } · ${moneyUsd(periodTotal)} en el período`;

  return (
    <CrmPanel
      title={selectedAdvertiserLabel ? `Gastos · ${selectedAdvertiserLabel}` : title}
      subtitle={panelSubtitle}
      className="flex h-full flex-col"
    >
      {sorted.length > 0 ? (
        <div className="space-y-3 border-b border-[var(--auth-divider)] px-4 py-3 sm:px-5">
          {selectedAdvertiserLabel ? (
            <p className="rounded-lg border border-[var(--auth-accent)]/20 bg-[var(--auth-accent-soft)]/40 px-3 py-2 text-[12px] text-[var(--auth-text)]">
              Mostrando gastos de{" "}
              <span className="font-semibold">{selectedAdvertiserLabel}</span>
              {selectedBm !== ALL_BMS ? ` · ${selectedBm}` : ""}
            </p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
            {advertiserOptions.length > 0 ? (
              <label className="block">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                  Cuenta ads
                </p>
                <select
                  value={selectedAdvertiser}
                  onChange={(e) => setSelectedAdvertiser(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--auth-divider)] bg-white px-3 text-[13px] font-medium text-[var(--auth-text)] outline-none focus:border-[var(--auth-accent)]"
                >
                  <option value={ALL_ADVERTISERS}>Todas las cuentas</option>
                  {advertiserOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
                maxDate={calendarMax}
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
          {grouped.map(([dateKey, rows]) => {
            const dateLabel =
              dateKey === "sin-fecha"
                ? "Sin fecha"
                : formatHecomFecha(dateKey) ?? dateKey;
            const dayTotal = sumGastos(rows);
            return (
              <li key={dateKey} className="border-b border-[var(--auth-divider)] last:border-0">
                <div className="sticky top-0 z-[1] flex items-center justify-between gap-3 bg-[var(--auth-bg)]/95 px-5 py-2 backdrop-blur">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                    {dateLabel}
                  </p>
                  <p className="text-[12px] font-semibold tabular-nums text-[var(--auth-text)]">
                    {moneyUsd(dayTotal)}
                  </p>
                </div>
                <ul>
                  {rows.map((row) => {
                    const fecha = formatHecomFecha(row.fecha ?? row.mes);
                    const bm = resolveBmForGasto(row, bmByAdvertiser);
                    const label = formatHecomGastoDisplay(row.camp, {
                      notas: row.notas,
                      fee: row.fee,
                      fecha: null,
                    });
                    return (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-3 border-t border-[var(--auth-divider)] px-5 py-3.5 hover:bg-[var(--auth-bg)]"
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
                            {row.codigo ? (
                              <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--auth-text-muted)]">
                                {row.codigo}
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
              </li>
            );
          })}
        </ul>
      )}
    </CrmPanel>
  );
}
