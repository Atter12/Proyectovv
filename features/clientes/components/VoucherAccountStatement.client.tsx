"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProfitDateRangeField } from "@/features/profit/components/ProfitDateRangeField.client";
import { moneyUsd } from "@/lib/format/money-usd";

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

function limaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 8)}01`;
}

function shiftYmd(ymd: string, deltaDays: number): string {
  const base = new Date(`${ymd}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
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

function formatShort(ymd: string, locale: string, byMonth: boolean): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  if (!byMonth) return String(d);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
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
  const today = useMemo(() => limaToday(), []);
  const [range, setRange] = useState(() => ({
    from: monthStart(limaToday()),
    to: limaToday(),
  }));

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
        if (!fecha) return null;
        return {
          fecha,
          monto: row.monto,
          metodo: row.metodo?.trim() || null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    return { spend, paid };
  }, [cobros, feePercent, gastos]);

  const earliest = useMemo(() => {
    const dates = [
      ...rows.spend.map((row) => row.fecha),
      ...rows.paid.map((row) => row.fecha),
    ].sort();
    return dates[0] ?? monthStart(today);
  }, [rows.paid, rows.spend, today]);

  const view = useMemo(() => {
    const from = range.from || monthStart(today);
    const to = range.to || today;
    const inRange = (fecha: string) => fecha >= from && fecha <= to;
    const through = (fecha: string) => fecha <= to;

    const rangeSpend = rows.spend.filter((row) => inRange(row.fecha));
    const rangePaid = rows.paid.filter((row) => inRange(row.fecha));
    const gasto = round2(rangeSpend.reduce((sum, row) => sum + row.gasto, 0));
    const fee = round2(rangeSpend.reduce((sum, row) => sum + row.fee, 0));
    const cobrado = round2(rangePaid.reduce((sum, row) => sum + row.monto, 0));
    const rangeSaldo = round2(cobrado - (gasto + fee));

    const cargoThru = round2(
      rows.spend
        .filter((row) => through(row.fecha))
        .reduce((sum, row) => sum + row.cargo, 0),
    );
    const cobradoThru = round2(
      rows.paid
        .filter((row) => through(row.fecha))
        .reduce((sum, row) => sum + row.monto, 0),
    );
    const owed = round2(cargoThru - cobradoThru);

    const span =
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000;
    const byMonth = span > 45;
    const buckets = new Map<string, Bucket>();

    function bucketKey(fecha: string): string {
      return byMonth ? fecha.slice(0, 7) : fecha;
    }

    function ensure(fecha: string) {
      const key = bucketKey(fecha);
      const existing = buckets.get(key);
      if (existing) return existing;
      const label = formatShort(byMonth ? `${key}-01` : fecha, locale, byMonth);
      const created: Bucket = { key, label, cargo: 0, paid: 0 };
      buckets.set(key, created);
      return created;
    }

    for (const row of rangeSpend) {
      const bucket = ensure(row.fecha);
      bucket.cargo = round2(bucket.cargo + row.cargo);
    }
    for (const row of rangePaid) {
      const bucket = ensure(row.fecha);
      bucket.paid = round2(bucket.paid + row.monto);
    }

    const series = [...buckets.values()].sort((a, b) =>
      a.key < b.key ? -1 : 1,
    );

    return {
      from,
      to,
      gasto,
      fee,
      cobrado,
      rangeSaldo,
      owed,
      byMonth,
      series,
      rangeSpend: [...rangeSpend].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
      rangePaid: [...rangePaid].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    };
  }, [locale, range.from, range.to, rows.paid, rows.spend, today]);

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

  function applyPreset(kind: "month" | "d7" | "all") {
    if (kind === "month") {
      setRange({ from: monthStart(today), to: today });
      return;
    }
    if (kind === "d7") {
      setRange({ from: shiftYmd(today, -6), to: today });
      return;
    }
    setRange({ from: earliest, to: today });
  }

  const presetClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
      active
        ? "border-[#ffd7b8] bg-[#fff7f0] text-[#c2410c]"
        : "border-[#e7e0d8] bg-white text-[#5c564e] hover:border-[#ffd7b8]"
    }`;

  const monthActive = range.from === monthStart(today) && range.to === today;
  const weekActive = range.from === shiftYmd(today, -6) && range.to === today;
  const allActive = range.from === earliest && range.to === today;

  return (
    <section className="space-y-4 rounded-2xl border border-[#ffd7b8] bg-[linear-gradient(165deg,#fffaf6_0%,#ffffff_48%,#fff7f0_100%)] p-4 shadow-[0_16px_40px_-28px_rgb(255_120_31_/_0.55)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#c2410c]">
            {t("eyebrow")}
          </p>
          <h3 className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]">
            {t("title")}
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-[#6b645c]">{t("subtitle")}</p>
        </div>
        <div className="w-full max-w-md space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={presetClass(monthActive)}
              onClick={() => applyPreset("month")}
            >
              {t("presetMonth")}
            </button>
            <button
              type="button"
              className={presetClass(weekActive)}
              onClick={() => applyPreset("d7")}
            >
              {t("preset7")}
            </button>
            <button
              type="button"
              className={presetClass(allActive)}
              onClick={() => applyPreset("all")}
            >
              {t("presetAll")}
            </button>
          </div>
          <ProfitDateRangeField
            from={range.from}
            to={range.to}
            max={today}
            onChange={(next) => {
              if (!next.from || !next.to) {
                setRange({ from: monthStart(today), to: today });
                return;
              }
              setRange(next);
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#ffd7b8]/80 bg-white px-5 py-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
          {heroLabel}
        </p>
        <p className={`mt-1 text-[2rem] font-bold tabular-nums tracking-[-0.03em] ${heroClass}`}>
          {moneyUsd(Math.abs(view.owed))}
        </p>
        <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[#6b645c]">
          {t("through", { date: formatDay(view.to, locale) })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label={t("rangeSpend")} value={moneyUsd(view.gasto)} />
        <Kpi label={t("rangeFee")} value={moneyUsd(view.fee)} />
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
          <p className="text-[12px] font-semibold text-[#1c1917]">
            {view.byMonth ? t("chartMonth") : t("chartDay")}
          </p>
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
                  title={`${formatDay(byMonth ? `${bucket.key}-01` : bucket.key, locale)}: ${t("legendCargo")} ${moneyUsd(bucket.cargo)} · ${t("legendPaid")} ${moneyUsd(bucket.paid)}`}
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
            key: `c-${index}-${row.fecha}`,
            date: formatDay(row.fecha, locale),
            detail: row.metodo || t("paidFallback"),
            amount: `+${moneyUsd(row.monto)}`,
            extra: null,
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
  const color =
    tone === "owe" ? "text-[#c2410c]" : tone === "paid" ? "text-[#15803d]" : "text-[#1c1917]";
  return (
    <div className="rounded-xl border border-[#f0ebe4] bg-white px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a8177]">
        {label}
      </p>
      <p className={`mt-1 text-[15px] font-bold tabular-nums ${color}`}>{value}</p>
      {hint ? <p className="mt-1 text-[10px] leading-4 text-[#8a8177]">{hint}</p> : null}
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
    <div className="overflow-hidden rounded-2xl border border-[#f0ebe4] bg-white">
      <div className="flex items-center justify-between border-b border-[#f0ebe4] px-4 py-3">
        <p className="text-[12px] font-semibold text-[#1c1917]">{title}</p>
        <span className="text-[11px] tabular-nums text-[#8a8177]">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-[#8a8177]">{empty}</p>
      ) : (
        <ul className="max-h-72 divide-y divide-[#f6f1eb] overflow-y-auto">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[#1c1917]">{row.detail}</p>
                <p className="text-[11px] text-[#8a8177]">
                  {row.date}
                  {row.extra ? ` · ${row.extra}` : ""}
                </p>
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
