"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { moneyUsd } from "@/lib/format/money-usd";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { getAdAccountFromCamp } from "@/lib/hecom/gasto-label";

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

    // Gasto del mes por cuenta ads (id de la plantilla camp); suma = Gastado + fee.
    const accountMap = new Map<
      string,
      { key: string; name: string | null; advertiserId: string | null; bm: string | null; gasto: number; fee: number }
    >();
    for (const row of rangeSpend) {
      const account = getAdAccountFromCamp(row.camp);
      const key = account.advertiserId ?? account.advertiserName ?? "";
      const entry = accountMap.get(key) ?? {
        key,
        name: account.advertiserName,
        advertiserId: account.advertiserId,
        bm: account.bm,
        gasto: 0,
        fee: 0,
      };
      entry.gasto += row.gasto;
      entry.fee += row.fee;
      accountMap.set(key, entry);
    }
    const byAccount = [...accountMap.values()]
      .map((entry) => ({
        ...entry,
        gasto: round2(entry.gasto),
        fee: round2(entry.fee),
        cargo: round2(round2(entry.gasto) + round2(entry.fee)),
      }))
      .filter((entry) => entry.cargo > 0.004)
      .sort((a, b) => b.cargo - a.cargo);

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
      byAccount,
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

  // Solo presentación: qué parte del consumo del mes ya se cubrió.
  const coverage =
    view.cargo > 0.004 ? Math.min(1, Math.max(0, view.cobrado / view.cargo)) : view.cobrado > 0.004 ? 1 : 0;

  return (
    <section className={embedded ? "space-y-4" : "space-y-4 rounded-[24px] bg-[#faf8f5] p-4 ring-1 ring-[#e8dfd4] sm:p-5"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
            {t("eyebrow")}
          </p>
          <h3 className="mt-1 text-[1.4rem] font-semibold tracking-[-0.03em] text-[#1a1714]">
            {t("title")}
          </h3>
          {!embedded ? (
            <p className="mt-1 text-[13px] capitalize text-[#5c564e]">{view.monthLabel}</p>
          ) : null}
        </div>
        <p className="max-w-sm text-[11px] leading-4 text-[#8a8177] sm:text-right">
          {t("through", {
            month: view.monthLabel,
            date: formatDay(view.to, locale),
          })}
        </p>
      </div>

      {/* Saldo + KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="relative col-span-2 overflow-hidden rounded-[22px] bg-[#1a1714] px-5 py-5 text-white sm:px-6 sm:py-6">
          <div
            className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-[#d47840]/25 blur-2xl"
            aria-hidden
          />
          <div className="relative">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                heroTone === "owe"
                  ? "bg-[#d47840]/20 text-[#f0b889]"
                  : heroTone === "favor"
                    ? "bg-[#9fd4b0]/15 text-[#9fd4b0]"
                    : "bg-white/10 text-white/80"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  heroTone === "owe"
                    ? "bg-[#e8955a]"
                    : heroTone === "favor"
                      ? "bg-[#6fbf8a]"
                      : "bg-white/70"
                }`}
                aria-hidden
              />
              {heroLabel}
            </span>
            <p className="mt-3 text-[2.4rem] font-semibold leading-none tabular-nums tracking-[-0.045em] sm:text-[2.75rem]">
              {moneyUsd(Math.abs(view.owed))}
            </p>
            <p className="mt-2 text-[12px] capitalize text-white/60">{view.monthLabel}</p>

            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] text-white/70">
                <span>
                  {t("rangePaid")} {moneyUsd(view.cobrado)}
                </span>
                <span className="tabular-nums">{Math.round(coverage * 100)}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#d47840] transition-[width] duration-500"
                  style={{ width: `${coverage * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-4 text-white/50">
                {view.surcharge > 0.004
                  ? t("surchargeNote", { amount: moneyUsd(view.surcharge) })
                  : t("subtitle")}
              </p>
            </div>
          </div>
        </div>

        <Kpi
          label={t("rangeCargo")}
          value={moneyUsd(view.cargo)}
          hint={t("rangeCargoHint")}
          className="col-span-2 sm:col-span-1"
          breakdown={[
            { label: t("rangeSpend"), value: moneyUsd(view.gasto) },
            { label: t("rangeFee"), value: moneyUsd(view.fee) },
          ]}
        />
        <Kpi
          label={t("rangePaid")}
          value={moneyUsd(view.cobradoBruto)}
          tone="paid"
          hint={
            view.surcharge > 0.004
              ? t("rangePaidHint", { applicable: moneyUsd(view.cobrado) })
              : undefined
          }
          className="col-span-2 sm:col-span-1"
        />
        <Kpi
          label={t("rangeResult")}
          value={moneyUsd(view.rangeSaldo)}
          tone={view.rangeSaldo < -0.004 ? "owe" : view.rangeSaldo > 0.004 ? "paid" : "neutral"}
          hint={t("rangeResultHint")}
          className="col-span-2 sm:col-span-2 lg:col-span-1"
        />
      </div>

      {view.byAccount.length > 0 ? (
        <AccountBreakdown
          title={t("byAccountTitle")}
          lead={t("byAccountLead")}
          count={t("byAccountCount", { count: view.byAccount.length })}
          totalLabel={t("byAccountTotal")}
          total={moneyUsd(view.cargo)}
          rows={view.byAccount.map((row) => ({
            key: row.key,
            name: row.name || t("byAccountUnknown"),
            meta: [row.bm, row.advertiserId ? `ID …${row.advertiserId.slice(-6)}` : null]
              .filter(Boolean)
              .join(" · "),
            amount: moneyUsd(row.cargo),
            detail: t("byAccountFee", { spend: moneyUsd(row.gasto), fee: moneyUsd(row.fee) }),
            share: view.cargo > 0.004 ? row.cargo / view.cargo : 0,
          }))}
        />
      ) : null}

      {/* Chart */}
      <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#e8dfd4]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          <div>
            <h4 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1714]">
              {t("chartDay")}
            </h4>
            <p className="mt-0.5 text-[12px] text-[#5c564e]">{t("chartDayLead")}</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-[#5c564e]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-[#d47840]" />
              {t("legendCargo")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-[#2f7a4a]" />
              {t("legendPaid")}
            </span>
          </div>
        </div>

        {view.series.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <p className="text-[13px] font-medium text-[#5c564e]">{t("emptyRange")}</p>
          </div>
        ) : (
          <>
            {selectedDay ? (
              <div className="px-4 pb-1 pt-2 sm:px-5">
                <p className="text-[11px] font-semibold capitalize text-[#8a8177]">
                  {formatDay(selectedDay.key, locale)}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                      className={`group flex min-w-0 flex-1 flex-col items-center rounded-xl px-0.5 pb-1.5 pt-1 transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#d47840] ${
                        isActive ? "bg-[#fff6ee]" : "hover:bg-[#fcfaf7]"
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
                      <div className="flex h-32 w-full items-end justify-center gap-0.5 sm:h-40">
                        <span
                          className={`w-[42%] max-w-[12px] rounded-t-[4px] transition duration-150 ${
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
                          className={`w-[42%] max-w-[12px] rounded-t-[4px] transition duration-150 ${
                            hasPaid
                              ? isActive
                                ? "bg-[#2f7a4a]"
                                : "bg-[#6a9a78]/90 group-hover:bg-[#4d8760]"
                              : "bg-[#f5f0ea]"
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
              <p className="border-t border-[#efe8df] px-4 py-2.5 text-[11px] leading-4 text-[#5c564e] sm:px-5">
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
          paid
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
  const dotClass =
    tone === "spend"
      ? "bg-[#d47840]"
      : tone === "paid"
        ? "bg-[#2f7a4a]"
        : "bg-[#ddd5cb]";
  return (
    <div className="min-w-0 rounded-2xl bg-[#fcfaf7] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#5c564e]">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 text-[1.15rem] font-semibold tabular-nums tracking-[-0.02em] text-[#1a1714]">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] leading-3.5 text-[#8a8177]">{hint}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  className = "",
  breakdown,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "paid" | "owe";
  className?: string;
  breakdown?: Array<{ label: string; value: string }>;
}) {
  const toneClass =
    tone === "paid"
      ? "text-[#15803d]"
      : tone === "owe"
        ? "text-[#c2531b]"
        : "text-[#1a1714]";
  return (
    <div
      className={`flex flex-col rounded-[22px] bg-white px-4 py-4 ring-1 ring-[#e8dfd4] sm:px-5 ${className}`}
    >
      <p className="text-[12px] font-medium text-[#5c564e]">{label}</p>
      <p
        className={`mt-2 text-[1.55rem] font-semibold leading-none tabular-nums tracking-[-0.035em] ${toneClass}`}
      >
        {value}
      </p>
      {breakdown && breakdown.length > 0 ? (
        <dl className="mt-3 space-y-1">
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
              <dt className="text-[#8a8177]">{item.label}</dt>
              <dd className="font-semibold tabular-nums text-[#3f3a34]">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {hint ? (
        <p className="mt-auto pt-3 text-[10px] leading-3.5 text-[#8a8177]">{hint}</p>
      ) : null}
    </div>
  );
}

function AccountBreakdown({
  title,
  lead,
  count,
  totalLabel,
  total,
  rows,
}: {
  title: string;
  lead: string;
  count: string;
  totalLabel: string;
  total: string;
  rows: Array<{
    key: string;
    name: string;
    meta: string;
    amount: string;
    detail: string;
    share: number;
  }>;
}) {
  return (
    <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-[#e8dfd4] sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#1a1714]">{title}</p>
          <p className="mt-0.5 text-[12px] text-[#5c564e]">{lead}</p>
        </div>
        <span className="rounded-full bg-[#f5f0ea] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#5c564e]">
          {count}
        </span>
      </div>
      <ul className="mt-3">
        {rows.map((row) => (
          <li key={row.key} className="border-b border-[#f3eee8] py-2.5 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#1a1714]">{row.name}</p>
                <p className="text-[11px] text-[#8a8177]">
                  {row.meta ? `${row.meta} · ` : ""}
                  {row.detail}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-semibold tabular-nums text-[#1a1714]">{row.amount}</p>
                <p className="text-[11px] tabular-nums text-[#8a8177]">{Math.round(row.share * 100)}%</p>
              </div>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f5f0ea]">
              <div
                className="h-full rounded-full bg-[#d47840]"
                style={{ width: `${Math.max(1, row.share * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-[#e8dfd4] pt-2.5">
        <p className="text-[12px] font-semibold text-[#5c564e]">{totalLabel}</p>
        <p className="text-[14px] font-semibold tabular-nums text-[#1a1714]">{total}</p>
      </div>
    </div>
  );
}

function MovementList({
  title,
  empty,
  rows,
  paid = false,
}: {
  title: string;
  empty: string;
  paid?: boolean;
  rows: Array<{
    key: string;
    date: string;
    detail: string;
    amount: string;
    extra: string | null;
  }>;
}) {
  return (
    <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-[#e8dfd4] sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#1a1714]">{title}</p>
        {rows.length > 0 ? (
          <span className="rounded-full bg-[#f5f0ea] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#5c564e]">
            {rows.length}
          </span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[#fcfaf7] px-3 py-6 text-center text-[12px] text-[#8a8177]">
          {empty}
        </p>
      ) : (
        <ul className="mt-3 max-h-72 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 border-b border-[#f3eee8] py-2.5 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    paid ? "bg-[#ecf7ef] text-[#1f6b3a]" : "bg-[#f5f0ea] text-[#b85f2e]"
                  }`}
                  aria-hidden
                >
                  {paid ? (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                      <path
                        d="m5 10.5 3.2 3L15 6.5"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                      <path
                        d="M4 14.5 8 10l3 3 5-6.5M12.5 6.5H16V10"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#1a1714]">{row.detail}</p>
                  <p className="text-[11px] text-[#8a8177]">{row.date}</p>
                  {row.extra ? (
                    <p className="text-[10px] text-[#9a9288]">{row.extra}</p>
                  ) : null}
                </div>
              </div>
              <p
                className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                  paid ? "text-[#15803d]" : "text-[#1a1714]"
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
