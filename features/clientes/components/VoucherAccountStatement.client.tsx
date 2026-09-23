"use client";

import { useMemo } from "react";
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
};

type Bucket = {
  key: string;
  label: string;
  cargo: number;
  paid: number;
};

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 8)}01`;
}

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

function feeUsd(gasto: number, fee: number | null, fallback: number): number {
  const pct =
    fee != null && Number.isFinite(fee)
      ? fee
      : Number.isFinite(fallback)
        ? fallback
        : 0;
  if (pct <= 0 || gasto <= 0) return 0;
  return Math.round(gasto * (pct / 100) * 100) / 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
}: Props) {
  const t = useTranslations("cobros.statement");
  const locale = useLocale();
  const today = useMemo(() => todayYmdInTz("America/Lima"), []);
  const spendTo = useMemo(() => spendMaxYmd(), []);
  const from = useMemo(() => monthStart(today), [today]);
  const monthYm = from.slice(0, 7);

  const rows = useMemo(() => {
    const spend = gastos
      .map((row) => {
        const fecha = ymdKey(row.fecha);
        if (!fecha) return null;
        const fee = feeUsd(row.gasto, row.fee, feePercent);
        return {
          fecha,
          gasto: row.gasto,
          fee,
          cargo: round2(row.gasto + fee),
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
          metodo: row.metodo?.trim() || null,
          notas: row.notas?.trim() || null,
          adjusted: /ajuste\s+excedente/i.test(row.notas ?? ""),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    return { spend, paid };
  }, [cobros, feePercent, gastos]);

  const view = useMemo(() => {
    // Gasto/fee: hasta ayer (jale Hecom).
    // Cobros: por periodo_resumen (Ajustar Hecom); si no hay, por fecha de pago.
    const inSpendRange = (fecha: string) => fecha >= from && fecha <= spendTo;
    const inPaidMonth = (row: (typeof rows.paid)[number]) => {
      if (row.periodo) return row.periodo === monthYm;
      if (!row.fecha) return false;
      return row.fecha >= from && row.fecha <= today;
    };
    const chartDayForPaid = (row: (typeof rows.paid)[number]) => {
      if (row.fecha && row.fecha >= from && row.fecha <= today) return row.fecha;
      // Ajuste con fecha de otro mes → día 1 del mes de deuda (visible en el chart).
      return from;
    };

    const rangeSpend = rows.spend.filter((row) => inSpendRange(row.fecha));
    const rangePaid = rows.paid.filter((row) => inPaidMonth(row));
    const gasto = round2(rangeSpend.reduce((sum, row) => sum + row.gasto, 0));
    const fee = round2(rangeSpend.reduce((sum, row) => sum + row.fee, 0));
    const cargo = round2(gasto + fee);
    const cobrado = round2(rangePaid.reduce((sum, row) => sum + row.monto, 0));
    const rangeSaldo = round2(cobrado - cargo);
    const owed = round2(cargo - cobrado);

    const buckets = new Map<string, Bucket>();

    function ensure(fecha: string) {
      const existing = buckets.get(fecha);
      if (existing) return existing;
      const created: Bucket = {
        key: fecha,
        label: String(Number(fecha.slice(8, 10))),
        cargo: 0,
        paid: 0,
      };
      buckets.set(fecha, created);
      return created;
    }

    for (const row of rangeSpend) {
      const bucket = ensure(row.fecha);
      bucket.cargo = round2(bucket.cargo + row.cargo);
    }
    for (const row of rangePaid) {
      const bucket = ensure(chartDayForPaid(row));
      bucket.paid = round2(bucket.paid + row.monto);
    }

    const series = [...buckets.values()].sort((a, b) =>
      a.key < b.key ? -1 : 1,
    );

    return {
      from,
      to: spendTo,
      monthLabel: formatMonthLabel(from, locale),
      gasto,
      fee,
      cargo,
      cobrado,
      rangeSaldo,
      owed,
      series,
      rangeSpend: [...rangeSpend].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
      rangePaid: [...rangePaid].sort((a, b) => {
        const da = a.fecha ?? chartDayForPaid(a);
        const db = b.fecha ?? chartDayForPaid(b);
        return da < db ? 1 : -1;
      }),
    };
  }, [from, locale, monthYm, rows.paid, rows.spend, spendTo, today]);

  const maxBar = Math.max(
    1,
    ...view.series.map((bucket) => Math.max(bucket.cargo, bucket.paid)),
  );
  const owes = view.owed > 0.004;
  const favor = view.owed < -0.004;
  const heroLabel = owes ? t("youOwe") : favor ? t("inYourFavor") : t("settled");
  const heroClass = owes
    ? "text-[#c2410c]"
    : favor
      ? "text-[#15803d]"
      : "text-[#1c1917]";

  return (
    <section className="space-y-4 rounded-2xl border border-[#ffd7b8] bg-[linear-gradient(165deg,#fffaf6_0%,#ffffff_48%,#fff7f0_100%)] p-4 shadow-[0_16px_40px_-28px_rgb(255_120_31_/_0.55)] sm:p-5">
      <div className="max-w-xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#c2410c]">
          {t("eyebrow")}
        </p>
        <h3 className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]">
          {t("title")}
        </h3>
        <p className="mt-1 text-[12px] leading-5 text-[#6b645c]">{t("subtitle")}</p>
        <p className="mt-2 text-[12px] font-semibold capitalize text-[#c2410c]">
          {view.monthLabel}
        </p>
      </div>

      <div className="rounded-2xl border border-[#ffd7b8]/80 bg-white px-5 py-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
          {heroLabel}
        </p>
        <p className={`mt-1 text-[2rem] font-bold tabular-nums tracking-[-0.03em] ${heroClass}`}>
          {moneyUsd(Math.abs(view.owed))}
        </p>
        <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#6b645c]">
          {t("through", {
            month: view.monthLabel,
            date: formatDay(view.to, locale),
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label={t("rangeSpend")} value={moneyUsd(view.gasto)} />
        <Kpi label={t("rangeFee")} value={moneyUsd(view.fee)} />
        <Kpi label={t("rangeCargo")} value={moneyUsd(view.cargo)} hint={t("rangeCargoHint")} />
        <Kpi label={t("rangePaid")} value={moneyUsd(view.cobrado)} tone="paid" />
        <Kpi
          label={t("rangeResult")}
          value={moneyUsd(view.rangeSaldo)}
          tone={view.rangeSaldo < -0.004 ? "owe" : view.rangeSaldo > 0.004 ? "paid" : "neutral"}
          hint={t("rangeResultHint")}
        />
      </div>

      <div className="rounded-2xl border border-[#f0ebe4] bg-white px-4 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-[#1c1917]">{t("chartDay")}</p>
          <div className="flex items-center gap-3 text-[11px] font-medium text-[#6b645c]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#fb923c]" />
              {t("legendCargo")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1c1917]" />
              {t("legendPaid")}
            </span>
          </div>
        </div>
        {view.series.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#8a8177]">{t("emptyRange")}</p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex h-36 min-w-full items-end gap-1"
              style={{ minWidth: `${Math.max(view.series.length * 28, 280)}px` }}
            >
              {view.series.map((bucket) => (
                <div
                  key={bucket.key}
                  className="flex min-w-0 flex-1 flex-col items-center"
                  title={`${formatDay(bucket.key, locale)}: ${t("legendCargo")} ${moneyUsd(bucket.cargo)} · ${t("legendPaid")} ${moneyUsd(bucket.paid)}`}
                >
                  <div className="flex h-24 w-full items-end justify-center gap-0.5">
                    <span
                      className="w-1.5 rounded-sm bg-[#fb923c] sm:w-2"
                      style={{
                        height: `${Math.max(bucket.cargo > 0 ? 4 : 0, (bucket.cargo / maxBar) * 96)}px`,
                      }}
                    />
                    <span
                      className="w-1.5 rounded-sm bg-[#1c1917] sm:w-2"
                      style={{
                        height: `${Math.max(bucket.paid > 0 ? 4 : 0, (bucket.paid / maxBar) * 96)}px`,
                      }}
                    />
                  </div>
                  <span className="mt-1 truncate text-[9px] font-medium text-[#8a8177]">
                    {bucket.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
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
            extra: row.fee > 0 ? t("feeLine", { amount: moneyUsd(row.fee) }) : null,
          }))}
        />
        <MovementList
          title={t("paidList")}
          empty={t("emptyPaid")}
          rows={view.rangePaid.map((row, index) => ({
            key: `c-${index}-${row.fecha ?? row.periodo}-${row.monto}`,
            date: formatDay(
              row.fecha && row.fecha >= view.from && row.fecha <= today
                ? row.fecha
                : view.from,
              locale,
            ),
            detail: row.metodo || t("paidFallback"),
            amount: `+${moneyUsd(row.monto)}`,
            extra: row.adjusted
              ? t("adjustLine")
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

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "paid" | "owe";
}) {
  const toneClass =
    tone === "paid"
      ? "text-[#15803d]"
      : tone === "owe"
        ? "text-[#c2410c]"
        : "text-[#1c1917]";
  return (
    <div className="rounded-xl border border-[#f0ebe4] bg-white px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
        {label}
      </p>
      <p className={`mt-1 text-[1.05rem] font-bold tabular-nums ${toneClass}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] leading-4 text-[#8a8177]">{hint}</p>
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
    <div className="rounded-2xl border border-[#f0ebe4] bg-white px-4 py-4">
      <p className="text-[12px] font-semibold text-[#1c1917]">
        {title}
        {rows.length > 0 ? (
          <span className="ml-1 font-normal text-[#8a8177]">({rows.length})</span>
        ) : null}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-[#8a8177]">{empty}</p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-3 border-b border-[#f5f1ec] pb-2 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[#1c1917]">
                  {row.detail}
                </p>
                <p className="text-[11px] text-[#8a8177]">{row.date}</p>
                {row.extra ? (
                  <p className="text-[10px] text-[#8a8177]">{row.extra}</p>
                ) : null}
              </div>
              <p
                className={`shrink-0 text-[12px] font-semibold tabular-nums ${
                  row.paid ? "text-[#15803d]" : "text-[#1c1917]"
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
