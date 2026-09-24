"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { moneyUsd } from "@/lib/format/money-usd";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

export type StatementGasto = {
  fecha: string | null;
  gasto: number;
  fee: number | null;
  camp: string | null;
};

export type StatementCobro = {
  fecha: string | null;
  monto: number;
  /** Monto que imputa a deuda (sin surcharge pasarela). Default = monto. */
  applicableMonto?: number;
  metodo: string | null;
  /** Mes de deuda en Hecom (Ajustar mueve plata acá, no en `fecha`). */
  periodoResumen?: string | null;
  notas?: string | null;
};

type Props = {
  gastos: StatementGasto[];
  cobros: StatementCobro[];
  feePercent: number;
  capped: boolean;
  /** Mes a mostrar `YYYY-MM` (Lima). Default = mes actual. */
  monthYm?: string;
  /** Dentro del shell de mes (sin doble card/borde). */
  embedded?: boolean;
};

function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return `${ym}-28`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

type Bucket = {
  key: string;
  label: string;
  /** Gasto del día (crudo; se redondea al mostrar). */
  gasto: number;
  /** Fee del día (crudo). */
  fee: number;
  cargo: number;
  paid: number;
  /** Gasto+fee acumulado desde el 1 del mes hasta este día (inclusive). */
  cargoCum: number;
  /** Cobros acumulados hasta este día. */
  paidCum: number;
};

/** Último día con jale Hecom de gasto (cierra hasta ayer, Lima). */
function spendMaxYmd(): string {
  return shiftYmd(todayYmdInTz("America/Lima"), -1);
}

function ymdKey(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (!dmy) return null;
  return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
}

/** `periodo_resumen` Hecom → `YYYY-MM` (igual que el Ajustar de Club). */
function periodoYm(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

/** Fee sin redondear (Hecom suma crudo y redondea al final en las tarjetas). */
function feeUsdRaw(gasto: number, fee: number | null, fallback: number): number {
  const pct =
    fee != null && Number.isFinite(fee)
      ? fee
      : Number.isFinite(fallback)
        ? fallback
        : 0;
  if (pct <= 0 || gasto <= 0) return 0;
  return gasto * (pct / 100);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Monto corto para etiquetas del chart ($192 / $12.5). */
function moneyCompact(value: number): string {
  if (value < 0.005) return "";
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return `$${Math.round(rounded)}`;
  }
  return `$${rounded.toFixed(1)}`;
}

function eachYmd(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = shiftYmd(cur, 1);
  }
  return out;
}

function formatDay(ymd: string, locale: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function formatMonthLabel(ymd: string, locale: string): string {
  const [y, m] = ymd.split("-").map(Number);
  if (!y || !m) return ymd;
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function VoucherAccountStatement({
  gastos,
  cobros,
  feePercent,
  capped,
  monthYm: monthYmProp,
  embedded = false,
}: Props) {
  const t = useTranslations("cobros.statement");
  const locale = useLocale();
  const today = useMemo(() => todayYmdInTz("America/Lima"), []);
  const currentYm = today.slice(0, 7);
  const monthYm = monthYmProp && /^\d{4}-\d{2}$/.test(monthYmProp)
    ? monthYmProp
    : currentYm;
  const isCurrentMonth = monthYm === currentYm;
  const from = `${monthYm}-01`;
  const monthLast = monthEnd(monthYm);
  // Mes actual: jale Hecom hasta ayer. Mes pasado: todo el mes.
  const spendTo = useMemo(() => {
    if (!isCurrentMonth) return monthLast;
    const yesterday = spendMaxYmd();
    return yesterday < from ? from : yesterday > monthLast ? monthLast : yesterday;
  }, [from, isCurrentMonth, monthLast]);
  const chartTo = useMemo(() => {
    if (!isCurrentMonth) return monthLast;
    // Cobros de hoy (ej. BCP) salen como barra verde.
    return today > spendTo ? (today > monthLast ? monthLast : today) : spendTo;
  }, [isCurrentMonth, monthLast, spendTo, today]);

  const rows = useMemo(() => {
    const spend = gastos
      .map((row) => {
        const fecha = ymdKey(row.fecha);
        if (!fecha) return null;
        const fee = feeUsdRaw(row.gasto, row.fee, feePercent);
        return {
          fecha,
          gasto: row.gasto,
          fee,
          cargo: row.gasto + fee,
          camp: row.camp?.trim() || null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const paid = cobros
      .map((row) => {
        const fecha = ymdKey(row.fecha);
        const periodo = periodoYm(row.periodoResumen);
        // Sin periodo ni fecha no se puede imputar (igual que Hecom).
        if (!periodo && !fecha) return null;
        return {
          fecha,
          periodo,
          monto: row.monto,
          applicable:
            row.applicableMonto != null && Number.isFinite(row.applicableMonto)
              ? row.applicableMonto
              : row.monto,
          metodo: row.metodo?.trim() || null,
          notas: row.notas?.trim() || null,
          adjusted: /ajuste\s+excedente/i.test(row.notas ?? ""),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    return { spend, paid };
  }, [cobros, feePercent, gastos]);

  const view = useMemo(() => {
    // Gasto/fee: mes actual hasta ayer; mes cerrado = todo el mes.
    // Cobros: por periodo_resumen (Ajustar Hecom); si no hay, por fecha de pago.
    const paidUpper = isCurrentMonth ? today : monthLast;
    const inSpendRange = (fecha: string) => fecha >= from && fecha <= spendTo;
    const inPaidMonth = (row: (typeof rows.paid)[number]) => {
      if (row.periodo) return row.periodo === monthYm;
      if (!row.fecha) return false;
      return row.fecha >= from && row.fecha <= paidUpper;
    };
    /**
     * Día del chart para un cobro:
     * - Fecha de pago en el mes (hasta chartTo) → ese día.
     * - Ajuste Hecom / fecha fuera del mes → día 1 (mes de deuda).
     */
    const chartDayForPaid = (row: (typeof rows.paid)[number]) => {
      if (row.fecha && row.fecha >= from && row.fecha <= chartTo) return row.fecha;
      return from;
    };

    const rangeSpend = rows.spend.filter((row) => inSpendRange(row.fecha));
    const rangePaid = rows.paid.filter((row) => inPaidMonth(row));
    // Igual Hecom: redondea gasto y fee al final; total = suma de esos.
    const gasto = round2(rangeSpend.reduce((sum, row) => sum + row.gasto, 0));
    const fee = round2(rangeSpend.reduce((sum, row) => sum + row.fee, 0));
    const cargo = round2(gasto + fee);
    const cobrado = round2(rangePaid.reduce((sum, row) => sum + row.applicable, 0));
    const cobradoBruto = round2(rangePaid.reduce((sum, row) => sum + row.monto, 0));
    const surcharge = round2(cobradoBruto - cobrado);
    const rangeSaldo = round2(cobrado - cargo);
    const owed = round2(cargo - cobrado);

    const buckets = new Map<string, Bucket>();

    function ensure(fecha: string) {
      const existing = buckets.get(fecha);
      if (existing) return existing;
      const created: Bucket = {
        key: fecha,
        label: String(Number(fecha.slice(8, 10))),
        gasto: 0,
        fee: 0,
        cargo: 0,
        paid: 0,
        cargoCum: 0,
        paidCum: 0,
      };
      buckets.set(fecha, created);
      return created;
    }

    for (const row of rangeSpend) {
      const bucket = ensure(row.fecha);
      bucket.gasto += row.gasto;
      bucket.fee += row.fee;
    }
    for (const row of rangePaid) {
      const bucket = ensure(chartDayForPaid(row));
      bucket.paid += row.applicable;
    }

    // Calendario completo + acumulados (mismo criterio de redondeo que las tarjetas).
    let gastoRun = 0;
    let feeRun = 0;
    let paidRun = 0;
    const series = eachYmd(from, chartTo).map((fecha) => {
      const existing = buckets.get(fecha);
      const dayGasto = existing?.gasto ?? 0;
      const dayFee = existing?.fee ?? 0;
      const dayPaid = existing?.paid ?? 0;
      gastoRun += dayGasto;
      feeRun += dayFee;
      paidRun += dayPaid;
      const dayCargo = round2(dayGasto + dayFee);
      // Prefijo con la misma fórmula que Gastado + Fee del mes.
      const cargoCum = round2(round2(gastoRun) + round2(feeRun));
      return {
        key: fecha,
        label: String(Number(fecha.slice(8, 10))),
        gasto: dayGasto,
        fee: dayFee,
        cargo: dayCargo,
        paid: round2(dayPaid),
        cargoCum,
        paidCum: round2(paidRun),
      };
    });

    const peakCargo = series.reduce(
      (best, row) => (row.cargo > best.cargo ? row : best),
      series[0] ?? {
        key: from,
        label: "1",
        gasto: 0,
        fee: 0,
        cargo: 0,
        paid: 0,
        cargoCum: 0,
        paidCum: 0,
      },
    );

    return {
      from,
      to: spendTo,
      chartTo,
      monthLabel: formatMonthLabel(from, locale),
      gasto,
      fee,
      cargo,
      cobrado,
      cobradoBruto,
      surcharge,
      rangeSaldo,
      owed,
      series,
      peakCargo,
      rangeSpend: [...rangeSpend].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
      rangePaid: [...rangePaid].sort((a, b) => {
        const da = a.fecha ?? chartDayForPaid(a);
        const db = b.fecha ?? chartDayForPaid(b);
        return da < db ? 1 : -1;
      }),
    };
  }, [
    chartTo,
    from,
    isCurrentMonth,
    locale,
    monthLast,
    monthYm,
    rows.paid,
    rows.spend,
    spendTo,
    today,
  ]);

  const maxCargo = Math.max(1, ...view.series.map((bucket) => bucket.cargo));
  const maxPaid = Math.max(1, ...view.series.map((bucket) => bucket.paid));
  const maxBar = Math.max(maxCargo, maxPaid);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const selectedDay = useMemo(() => {
    // Por defecto el último día del rango (acumulado del mes a la fecha).
    // Si cambió el mes y el día activo no existe, cae al último del series.
    const key =
      activeDay && view.series.some((row) => row.key === activeDay)
        ? activeDay
        : view.series[view.series.length - 1]?.key ?? null;
    return view.series.find((row) => row.key === key) ?? null;
  }, [activeDay, view.series]);
  const owes = view.owed > 0.004;
  const favor = view.owed < -0.004;
  const heroLabel = owes ? t("youOwe") : favor ? t("inYourFavor") : t("settled");
  const heroTone = owes ? "owe" : favor ? "favor" : "ok";

  return (
    <section className={embedded ? "space-y-5" : "space-y-5 rounded-2xl border border-[#e8dfd4] bg-[#faf8f5] p-4 sm:p-5"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
            {t("eyebrow")}
          </p>
          <h3 className="mt-1 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#1a1714]">
            {t("title")}
          </h3>
          {!embedded ? (
            <p className="mt-1 text-[13px] capitalize text-[#9a6b4a]">{view.monthLabel}</p>
          ) : null}
        </div>
        <p className="max-w-sm text-right text-[11px] leading-4 text-[#8a8177]">
          {t("through", {
            month: view.monthLabel,
            date: formatDay(view.to, locale),
          })}
        </p>
      </div>

      {/* Hero saldo */}
      <div
        className={`relative overflow-hidden rounded-2xl px-5 py-6 sm:px-7 sm:py-7 ${
          heroTone === "favor"
            ? "bg-[linear-gradient(135deg,#ecf7ef_0%,#f4faf6_55%,#ffffff_100%)] ring-1 ring-[#c5e0ce]"
            : heroTone === "owe"
              ? "bg-[linear-gradient(135deg,#fff1e6_0%,#fff7f0_55%,#ffffff_100%)] ring-1 ring-[#f0c9a8]"
              : "bg-white ring-1 ring-[#e8dfd4]"
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full opacity-40 blur-2xl ${
            heroTone === "favor"
              ? "bg-[#9fd4b0]"
              : heroTone === "owe"
                ? "bg-[#f0b889]"
                : "bg-[#ddd5cb]"
          }`}
          aria-hidden
        />
        <p
          className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
            heroTone === "favor"
              ? "text-[#1f6b3a]"
              : heroTone === "owe"
                ? "text-[#b45309]"
                : "text-[#6b645c]"
          }`}
        >
          {heroLabel}
        </p>
        <p
          className={`mt-2 text-[2.55rem] font-semibold tabular-nums tracking-[-0.04em] sm:text-[2.85rem] ${
            heroTone === "favor"
              ? "text-[#146b38]"
              : heroTone === "owe"
                ? "text-[#c2410c]"
                : "text-[#1a1714]"
          }`}
        >
          {moneyUsd(Math.abs(view.owed))}
        </p>
        {view.surcharge > 0.004 ? (
          <p className="mt-2 max-w-xl text-[11px] leading-4 text-[#8a8177]">
            {t("surchargeNote", { amount: moneyUsd(view.surcharge) })}
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-[#6b645c]">{t("subtitle")}</p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#e8dfd4] ring-1 ring-[#e8dfd4] sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label={t("rangeSpend")} value={moneyUsd(view.gasto)} />
        <Kpi label={t("rangeFee")} value={moneyUsd(view.fee)} />
        <Kpi label={t("rangeCargo")} value={moneyUsd(view.cargo)} hint={t("rangeCargoHint")} />
        <Kpi
          label={t("rangePaid")}
          value={moneyUsd(view.cobradoBruto)}
          tone="paid"
          hint={
            view.surcharge > 0.004
              ? t("rangePaidHint", { applicable: moneyUsd(view.cobrado) })
              : undefined
          }
        />
        <Kpi
          label={t("rangeResult")}
          value={moneyUsd(view.rangeSaldo)}
          tone={view.rangeSaldo < -0.004 ? "owe" : view.rangeSaldo > 0.004 ? "paid" : "neutral"}
          hint={t("rangeResultHint")}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Chart */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#e8dfd4]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe8df] px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a6b4a]">
              {t("chartDay")}
            </p>
            <p className="mt-0.5 text-[13px] text-[#5c564e]">{t("chartDayLead")}</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-[#6b645c]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#d47840]" />
              {t("legendCargo")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#2f7a4a]" />
              {t("legendPaid")}
            </span>
          </div>
        </div>

        {view.series.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-[#8a8177] sm:px-5">
            {t("emptyRange")}
          </p>
        ) : (
          <>
            {selectedDay ? (
              <div className="border-b border-[#efe8df] bg-[#fcfaf7] px-4 py-4 sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a8177]">
                  {formatDay(selectedDay.key, locale)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <DayMetric
                    label={t("chartDaySpend")}
                    value={moneyUsd(selectedDay.cargo)}
                    hint={t("chartDaySpendHint")}
                    tone="spend"
                  />
                  <DayMetric
                    label={t("chartCumSpend")}
                    value={moneyUsd(selectedDay.cargoCum)}
                    hint={t("chartCumSpendHint")}
                  />
                  <DayMetric
                    label={t("chartDayPaid")}
                    value={moneyUsd(selectedDay.paid)}
                    hint={t("chartDayPaidHint")}
                    tone="paid"
                  />
                  <DayMetric
                    label={t("chartCumPaid")}
                    value={moneyUsd(selectedDay.paidCum)}
                    hint={t("chartCumPaidHint")}
                    tone="paid"
                  />
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto px-2 pb-2 pt-3 sm:px-3">
              <div
                className="flex items-end gap-1 px-1"
                style={{ minWidth: `${Math.max(view.series.length * 36, 280)}px` }}
              >
                {view.series.map((bucket) => {
                  const cargoH =
                    bucket.cargo > 0
                      ? Math.max(10, (bucket.cargo / maxBar) * 100)
                      : 0;
                  const paidH =
                    bucket.paid > 0.004
                      ? Math.max(10, (bucket.paid / maxBar) * 100)
                      : 0;
                  const isActive = selectedDay?.key === bucket.key;
                  const isPeak =
                    view.peakCargo.key === bucket.key && view.peakCargo.cargo > 0;
                  const hasPaid = bucket.paid > 0.004;
                  const showCargoLabel = isActive || isPeak;
                  const showPaidLabel = isActive && hasPaid;
                  return (
                    <button
                      key={bucket.key}
                      type="button"
                      onClick={() => setActiveDay(bucket.key)}
                      onMouseEnter={() => setActiveDay(bucket.key)}
                      className={`group flex min-w-0 flex-1 flex-col items-center rounded-lg px-0.5 pb-1.5 pt-1 transition duration-150 ${
                        isActive
                          ? "bg-[#fff6ee]"
                          : "hover:bg-[#faf8f5]"
                      }`}
                      aria-label={`${formatDay(bucket.key, locale)}: ${t("chartDaySpend")} ${moneyUsd(bucket.cargo)}, ${t("chartDayPaid")} ${moneyUsd(bucket.paid)}`}
                      title={`${formatDay(bucket.key, locale)}\n${t("legendCargo")}: ${moneyUsd(bucket.cargo)}\n${t("legendPaid")}: ${moneyUsd(bucket.paid)}`}
                    >
                      <span
                        className={`mb-0.5 flex h-3.5 items-end text-[8px] font-bold tabular-nums leading-none ${
                          showCargoLabel ? "text-[#b85f2e]" : "text-transparent"
                        }`}
                      >
                        {showCargoLabel && bucket.cargo > 0
                          ? moneyCompact(bucket.cargo)
                          : "·"}
                      </span>
                      <span
                        className={`mb-1 flex h-3.5 items-end text-[8px] font-bold tabular-nums leading-none ${
                          showPaidLabel ? "text-[#1f6b3a]" : "text-transparent"
                        }`}
                      >
                        {showPaidLabel ? moneyCompact(bucket.paid) : "·"}
                      </span>
                      <div className="flex h-32 w-full items-end justify-center gap-0.5 sm:h-36">
                        <span
                          className={`w-[40%] max-w-[11px] rounded-t-[3px] transition duration-150 ${
                            bucket.cargo > 0
                              ? isActive || isPeak
                                ? "bg-[#d47840]"
                                : "bg-[#e8b48a]/85 group-hover:bg-[#e09a66]"
                              : "bg-[#efe8df]"
                          }`}
                          style={{
                            height: `${cargoH}%`,
                            minHeight: bucket.cargo > 0 ? 6 : 2,
                          }}
                        />
                        <span
                          className={`w-[40%] max-w-[11px] rounded-t-[3px] transition duration-150 ${
                            hasPaid
                              ? isActive
                                ? "bg-[#2f7a4a]"
                                : "bg-[#6a9a78]/90 group-hover:bg-[#4d8760]"
                              : "bg-[#eef2ef]"
                          }`}
                          style={{
                            height: `${paidH}%`,
                            minHeight: hasPaid ? 6 : 2,
                          }}
                        />
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-semibold tabular-nums ${
                          isActive ? "text-[#1a1714]" : "text-[#9a9288]"
                        }`}
                      >
                        {bucket.label}
                      </span>
                      <span
                        className={`mt-1 h-0.5 w-3 rounded-full transition ${
                          isActive ? "bg-[#d47840]" : "bg-transparent"
                        }`}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {view.peakCargo.cargo > 0 ? (
              <p className="border-t border-[#efe8df] px-4 py-2.5 text-[11px] leading-4 text-[#6b645c] sm:px-5">
                {t("chartPeak", {
                  day: formatDay(view.peakCargo.key, locale),
                  amount: moneyUsd(view.peakCargo.cargo),
                })}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MovementList
          title={t("spendList")}
          empty={t("emptySpend")}
          rows={view.rangeSpend.map((row, index) => ({
            key: `g-${index}-${row.fecha}`,
            date: formatDay(row.fecha, locale),
            detail: row.camp || t("spendFallback"),
            amount: moneyUsd(row.gasto),
            extra: row.fee > 0 ? t("feeLine", { amount: moneyUsd(round2(row.fee)) }) : null,
          }))}
        />
        <MovementList
          title={t("paidList")}
          empty={t("emptyPaid")}
          rows={view.rangePaid.map((row, index) => ({
            key: `c-${index}-${row.fecha ?? row.periodo}-${row.monto}`,
            date: formatDay(
              row.fecha && row.fecha >= view.from && row.fecha <= view.chartTo
                ? row.fecha
                : view.from,
              locale,
            ),
            detail: row.metodo || t("paidFallback"),
            amount: `+${moneyUsd(row.monto)}`,
            extra: row.adjusted
              ? t("adjustLine")
              : round2(row.monto - row.applicable) > 0.004
                ? t("surchargeLine", {
                    amount: moneyUsd(round2(row.monto - row.applicable)),
                  })
                : row.fecha && row.periodo && row.fecha.slice(0, 7) !== row.periodo
                  ? t("adjustPeriodHint", {
                      paid: formatDay(row.fecha, locale),
                    })
                  : null,
            paid: true,
          }))}
        />
      </div>

      {capped ? (
        <p className="text-[11px] leading-5 text-[#8a8177]">{t("capped")}</p>
      ) : null}
    </section>
  );
}

function DayMetric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "spend" | "paid";
}) {
  const valueClass =
    tone === "spend"
      ? "text-[#b85f2e]"
      : tone === "paid"
        ? "text-[#1f6b3a]"
        : "text-[#1a1714]";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
        {label}
      </p>
      <p className={`mt-1 text-[1.2rem] font-semibold tabular-nums tracking-[-0.02em] ${valueClass}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] leading-3.5 text-[#9a9288]">{hint}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  className = "",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "paid" | "owe";
  className?: string;
}) {
  const toneClass =
    tone === "paid"
      ? "text-[#15803d]"
      : tone === "owe"
        ? "text-[#c2410c]"
        : "text-[#1a1714]";
  return (
    <div className={`bg-[#faf8f5] px-3.5 py-3.5 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
        {label}
      </p>
      <p className={`mt-1.5 text-[1.1rem] font-semibold tabular-nums tracking-[-0.02em] ${toneClass}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] leading-3.5 text-[#9a9288]">{hint}</p>
      ) : null}
    </div>
  );
}

function MovementList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    key: string;
    date: string;
    detail: string;
    amount: string;
    extra: string | null;
    paid?: boolean;
  }>;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-[#e8dfd4]">
      <p className="text-[12px] font-semibold text-[#1a1714]">
        {title}
        {rows.length > 0 ? (
          <span className="ml-1.5 font-normal text-[#8a8177]">({rows.length})</span>
        ) : null}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-[#8a8177]">{empty}</p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-0 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-3 border-b border-[#f3eee8] py-2.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[#1a1714]">
                  {row.detail}
                </p>
                <p className="text-[11px] text-[#8a8177]">{row.date}</p>
                {row.extra ? (
                  <p className="text-[10px] text-[#9a9288]">{row.extra}</p>
                ) : null}
              </div>
              <p
                className={`shrink-0 text-[12px] font-semibold tabular-nums ${
                  row.paid ? "text-[#15803d]" : "text-[#1a1714]"
                }`}
              >
                {row.amount}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
