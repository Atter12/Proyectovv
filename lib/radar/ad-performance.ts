/**
 * Rendimiento por anuncio a partir de radar_ad_daily (sin dependencias, para tests).
 *
 * Suma los días del rango por anuncio y calcula CTR, costo por resultado y
 * retención del video (qué parte de las reproducciones llega a 2 s y a 6 s).
 * Las tasas se recalculan desde los totales: nunca se promedian porcentajes.
 */

export type AdDayRow = {
  advertiserId: string;
  adId: string;
  statDate: string;
  adName: string | null;
  campaignName: string | null;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  results: number | null;
  videoPlayActions: number | null;
  videoWatched2s: number | null;
  videoWatched6s: number | null;
};

export type AdPerformance = {
  adId: string;
  advertiserId: string;
  adName: string;
  campaignName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  /** CTR en % (1.25 = 1.25%). */
  ctr: number | null;
  costPerResult: number | null;
  /** Fracción de reproducciones que llega a 2 s / 6 s (0–1). */
  hold2s: number | null;
  hold6s: number | null;
  /** Costo por resultado del anuncio ÷ el del cliente (1 = igual; menos es mejor). */
  vsAverage: number | null;
  daysActive: number;
  lastDate: string;
};

export type AdPerformanceSummary = {
  ads: AdPerformance[];
  totals: {
    spend: number;
    results: number;
    costPerResult: number | null;
    ctr: number | null;
    hold6s: number | null;
  };
  /** Último día con datos guardados. */
  dataThrough: string | null;
};

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function ratio(num: number, den: number, digits = 4): number | null {
  return den > 0 ? round(num / den, digits) : null;
}

export function summarizeAdPerformance(rows: AdDayRow[]): AdPerformanceSummary {
  type Acc = Omit<AdPerformance, "ctr" | "costPerResult" | "hold2s" | "hold6s" | "vsAverage" | "daysActive"> & {
    plays: number;
    held2: number;
    held6: number;
    days: Set<string>;
  };
  const byAd = new Map<string, Acc>();
  let dataThrough: string | null = null;

  for (const row of rows) {
    if (!row.adId) continue;
    const key = `${row.advertiserId}:${row.adId}`;
    const acc =
      byAd.get(key) ??
      ({
        adId: row.adId,
        advertiserId: row.advertiserId,
        adName: row.adName || row.adId,
        campaignName: row.campaignName,
        spend: 0,
        impressions: 0,
        clicks: 0,
        results: 0,
        plays: 0,
        held2: 0,
        held6: 0,
        days: new Set<string>(),
        lastDate: row.statDate,
      } as Acc);
    acc.spend += row.spend || 0;
    acc.impressions += row.impressions ?? 0;
    acc.clicks += row.clicks ?? 0;
    acc.results += row.results ?? 0;
    acc.plays += row.videoPlayActions ?? 0;
    acc.held2 += row.videoWatched2s ?? 0;
    acc.held6 += row.videoWatched6s ?? 0;
    if ((row.spend || 0) > 0) acc.days.add(row.statDate);
    if (row.statDate > acc.lastDate) {
      acc.lastDate = row.statDate;
      // El nombre más reciente gana (el anuncio pudo renombrarse).
      if (row.adName) acc.adName = row.adName;
      if (row.campaignName) acc.campaignName = row.campaignName;
    }
    byAd.set(key, acc);
    if (!dataThrough || row.statDate > dataThrough) dataThrough = row.statDate;
  }

  const accs = [...byAd.values()].filter((a) => a.spend > 0 || a.impressions > 0);
  const totalSpend = accs.reduce((s, a) => s + a.spend, 0);
  const totalResults = accs.reduce((s, a) => s + a.results, 0);
  const avgCpr = totalResults > 0 ? totalSpend / totalResults : null;

  const ads: AdPerformance[] = accs
    .map((a) => {
      const costPerResult = a.results > 0 ? round(a.spend / a.results, 2) : null;
      return {
        adId: a.adId,
        advertiserId: a.advertiserId,
        adName: a.adName,
        campaignName: a.campaignName,
        spend: round(a.spend, 2),
        impressions: a.impressions,
        clicks: a.clicks,
        results: round(a.results, 2),
        ctr: a.impressions > 0 ? round((a.clicks / a.impressions) * 100, 2) : null,
        costPerResult,
        hold2s: ratio(a.held2, a.plays, 3),
        hold6s: ratio(a.held6, a.plays, 3),
        vsAverage: costPerResult != null && avgCpr ? round(a.spend / a.results / avgCpr, 2) : null,
        daysActive: a.days.size,
        lastDate: a.lastDate,
      };
    })
    .sort((x, y) => y.spend - x.spend);

  const totalImp = accs.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = accs.reduce((s, a) => s + a.clicks, 0);
  const totalPlays = accs.reduce((s, a) => s + a.plays, 0);
  const totalHeld6 = accs.reduce((s, a) => s + a.held6, 0);

  return {
    ads,
    totals: {
      spend: round(totalSpend, 2),
      results: round(totalResults, 2),
      costPerResult: avgCpr != null ? round(avgCpr, 2) : null,
      ctr: totalImp > 0 ? round((totalClicks / totalImp) * 100, 2) : null,
      hold6s: ratio(totalHeld6, totalPlays, 3),
    },
    dataThrough,
  };
}
