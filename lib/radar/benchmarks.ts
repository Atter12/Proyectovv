/**
 * Referencias de costo del rubro a partir de radar_ad_daily (sin dependencias, para tests).
 *
 * Privacidad: se agrega por cuenta (nunca por anuncio) y solo se devuelve algo
 * si el grupo tiene al menos `minAccounts` cuentas de clientes distintos; lo
 * que sale son rangos (percentiles), nunca la cifra de una cuenta.
 */

export type BenchmarkRow = {
  advertiserId: string;
  hecomClienteId: string | null;
  spend: number;
  results: number | null;
  impressions: number | null;
  clicks: number | null;
  videoPlayActions: number | null;
  videoWatched6s: number | null;
};

export type Range = { p25: number; p50: number; p75: number };

export type CategoryBenchmark = {
  accounts: number;
  costPerResult: Range | null;
  ctr: Range | null;
  /** Fracción de reproducciones que llega a 6 s. */
  hold6s: Range | null;
};

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  const value = sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (index - lo);
  return Math.round(value * 10000) / 10000;
}

function range(values: number[], minCount: number): Range | null {
  const clean = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (clean.length < minCount) return null;
  return { p25: percentile(clean, 0.25), p50: percentile(clean, 0.5), p75: percentile(clean, 0.75) };
}

export function categoryBenchmark(rows: BenchmarkRow[], minAccounts = 5, minSpend = 5): CategoryBenchmark | null {
  type Acc = { cliente: string; spend: number; results: number; imp: number; clicks: number; plays: number; held: number };
  const byAccount = new Map<string, Acc>();
  for (const row of rows) {
    if (!row.advertiserId || !row.hecomClienteId) continue;
    const acc = byAccount.get(row.advertiserId) ?? {
      cliente: row.hecomClienteId,
      spend: 0,
      results: 0,
      imp: 0,
      clicks: 0,
      plays: 0,
      held: 0,
    };
    acc.spend += row.spend || 0;
    acc.results += row.results ?? 0;
    acc.imp += row.impressions ?? 0;
    acc.clicks += row.clicks ?? 0;
    acc.plays += row.videoPlayActions ?? 0;
    acc.held += row.videoWatched6s ?? 0;
    byAccount.set(row.advertiserId, acc);
  }

  const accounts = [...byAccount.values()].filter((a) => a.spend >= minSpend);
  const clientes = new Set(accounts.map((a) => a.cliente));
  // El mínimo cuenta clientes distintos: cinco cuentas de un mismo cliente no anonimizan nada.
  if (clientes.size < minAccounts) return null;

  return {
    accounts: accounts.length,
    costPerResult: range(
      accounts.filter((a) => a.results > 0).map((a) => a.spend / a.results),
      minAccounts,
    ),
    ctr: range(
      accounts.filter((a) => a.imp > 0).map((a) => (a.clicks / a.imp) * 100),
      minAccounts,
    ),
    hold6s: range(
      accounts.filter((a) => a.plays > 0).map((a) => a.held / a.plays),
      minAccounts,
    ),
  };
}
