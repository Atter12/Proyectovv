import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

export type CobranzaSnapshotGasto = {
  fecha: string | null;
  gasto: number;
  fee: number | null;
  camp: string | null;
};

export type CobranzaSnapshotCobro = {
  fecha: string | null;
  monto: number;
  applicableMonto?: number;
  metodo: string | null;
  periodoResumen?: string | null;
  notas?: string | null;
};

export type CobranzaMonthSnapshotInput = {
  gastos: CobranzaSnapshotGasto[];
  cobros: CobranzaSnapshotCobro[];
  feePercent: number;
  /** Mes `YYYY-MM` (Lima). */
  monthYm: string;
  /**
   * Tope de gasto inclusive `YYYY-MM-DD`.
   * Si no viene: mes actual → ayer Lima; mes cerrado → fin de mes.
   */
  corteYmd?: string | null;
  /** Hoy Lima (inyectable en tests). */
  todayYmd?: string;
};

export type CobranzaDaySeries = {
  key: string;
  label: string;
  gasto: number;
  fee: number;
  cargo: number;
  paid: number;
  cargoCum: number;
  paidCum: number;
};

export type CobranzaMonthSnapshot = {
  monthYm: string;
  from: string;
  spendTo: string;
  chartTo: string;
  gasto: number;
  fee: number;
  cargo: number;
  cobrado: number;
  cobradoBruto: number;
  surcharge: number;
  /** Cobrado − cargo (positivo = a favor). */
  rangeSaldo: number;
  /** max(0, cargo − cobrado) — deuda a cobrar. */
  deudaCorte: number;
  /** cargo − cobrado sin clamp (puede ser negativo = a favor). */
  delMes: number;
  series: CobranzaDaySeries[];
  peakCargo: CobranzaDaySeries;
  cobros: Array<{
    fecha: string | null;
    monto: number;
    applicable: number;
    metodo: string | null;
    periodoResumen: string | null;
  }>;
};

function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return `${ym}-28`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
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

function periodoYm(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

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

function clampSpendTo(monthYm: string, corteYmd: string | null | undefined, today: string): string {
  const from = `${monthYm}-01`;
  const last = monthEnd(monthYm);
  const currentYm = today.slice(0, 7);
  const isCurrentMonth = monthYm === currentYm;
  const defaultTo = isCurrentMonth
    ? (() => {
        const yesterday = shiftYmd(today, -1);
        return yesterday < from ? from : yesterday > last ? last : yesterday;
      })()
    : last;

  const corte =
    corteYmd && /^\d{4}-\d{2}-\d{2}$/.test(corteYmd.trim()) ? corteYmd.trim() : null;
  if (!corte) return defaultTo;
  if (corte < from) return from;
  if (corte > last) return last;
  return corte;
}

/**
 * Misma lógica numérica que `VoucherAccountStatement` (Cuánto debes),
 * con tope de gasto opcional (`corteYmd`).
 */
export function buildCobranzaMonthSnapshot(
  input: CobranzaMonthSnapshotInput,
): CobranzaMonthSnapshot {
  const today = input.todayYmd ?? todayYmdInTz("America/Lima");
  const monthYm = /^\d{4}-\d{2}$/.test(input.monthYm)
    ? input.monthYm
    : today.slice(0, 7);
  const from = `${monthYm}-01`;
  const monthLast = monthEnd(monthYm);
  const isCurrentMonth = monthYm === today.slice(0, 7);
  const spendTo = clampSpendTo(monthYm, input.corteYmd, today);
  const chartTo = isCurrentMonth
    ? today > spendTo
      ? today > monthLast
        ? monthLast
        : today
      : spendTo
    : monthLast;
  const paidUpper = isCurrentMonth ? today : monthLast;
  const feePercent = input.feePercent;

  const spend = input.gastos
    .map((row) => {
      const fecha = ymdKey(row.fecha);
      if (!fecha) return null;
      const fee = feeUsdRaw(row.gasto, row.fee, feePercent);
      return { fecha, gasto: row.gasto, fee, cargo: row.gasto + fee };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const paid = input.cobros
    .map((row) => {
      const fecha = ymdKey(row.fecha);
      const periodo = periodoYm(row.periodoResumen);
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
        periodoResumen: row.periodoResumen?.trim() || null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const inSpendRange = (fecha: string) => fecha >= from && fecha <= spendTo;
  const inPaidMonth = (row: (typeof paid)[number]) => {
    if (row.periodo) return row.periodo === monthYm;
    if (!row.fecha) return false;
    return row.fecha >= from && row.fecha <= paidUpper;
  };
  const chartDayForPaid = (row: (typeof paid)[number]) => {
    if (row.fecha && row.fecha >= from && row.fecha <= chartTo) return row.fecha;
    return from;
  };

  const rangeSpend = spend.filter((row) => inSpendRange(row.fecha));
  const rangePaid = paid.filter((row) => inPaidMonth(row));
  const gasto = round2(rangeSpend.reduce((sum, row) => sum + row.gasto, 0));
  const fee = round2(rangeSpend.reduce((sum, row) => sum + row.fee, 0));
  const cargo = round2(gasto + fee);
  const cobrado = round2(rangePaid.reduce((sum, row) => sum + row.applicable, 0));
  const cobradoBruto = round2(rangePaid.reduce((sum, row) => sum + row.monto, 0));
  const surcharge = round2(cobradoBruto - cobrado);
  const rangeSaldo = round2(cobrado - cargo);
  const delMes = round2(cargo - cobrado);
  const deudaCorte = Math.max(0, delMes);

  type Bucket = {
    gasto: number;
    fee: number;
    paid: number;
  };
  const buckets = new Map<string, Bucket>();
  function ensure(fecha: string): Bucket {
    const existing = buckets.get(fecha);
    if (existing) return existing;
    const created = { gasto: 0, fee: 0, paid: 0 };
    buckets.set(fecha, created);
    return created;
  }
  for (const row of rangeSpend) {
    const b = ensure(row.fecha);
    b.gasto += row.gasto;
    b.fee += row.fee;
  }
  for (const row of rangePaid) {
    ensure(chartDayForPaid(row)).paid += row.applicable;
  }

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
    return {
      key: fecha,
      label: String(Number(fecha.slice(8, 10))),
      gasto: dayGasto,
      fee: dayFee,
      cargo: round2(dayGasto + dayFee),
      paid: round2(dayPaid),
      cargoCum: round2(round2(gastoRun) + round2(feeRun)),
      paidCum: round2(paidRun),
    };
  });

  const emptyPeak: CobranzaDaySeries = {
    key: from,
    label: "1",
    gasto: 0,
    fee: 0,
    cargo: 0,
    paid: 0,
    cargoCum: 0,
    paidCum: 0,
  };
  const peakCargo = series.reduce(
    (best, row) => (row.cargo > best.cargo ? row : best),
    series[0] ?? emptyPeak,
  );

  return {
    monthYm,
    from,
    spendTo,
    chartTo,
    gasto,
    fee,
    cargo,
    cobrado,
    cobradoBruto,
    surcharge,
    rangeSaldo,
    deudaCorte,
    delMes,
    series,
    peakCargo,
    cobros: rangePaid
      .map((row) => ({
        fecha: row.fecha,
        monto: round2(row.monto),
        applicable: round2(row.applicable),
        metodo: row.metodo,
        periodoResumen: row.periodoResumen,
      }))
      .sort((a, b) => {
        const da = a.fecha ?? "";
        const db = b.fecha ?? "";
        return da < db ? 1 : -1;
      }),
  };
}
