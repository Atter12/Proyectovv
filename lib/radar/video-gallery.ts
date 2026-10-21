/**
 * Galería de videos del cliente a partir de radar_ad_daily (sin dependencias, para tests).
 *
 * Agrupa por video (un mismo video puede estar en varios anuncios), suma el
 * rango y le pone una etiqueta simple: ganador, sin ventas, cansado, caro o
 * estable. Las tasas salen de los totales: nunca se promedian porcentajes.
 */

export type VideoDayRow = {
  advertiserId: string;
  adId: string;
  videoId: string | null;
  /** Publicación de TikTok (anuncios Spark: no tienen video_id). */
  tiktokItemId: string | null;
  statDate: string;
  adName: string | null;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  results: number | null;
  videoPlayActions: number | null;
  videoWatched6s: number | null;
};

export type VideoVerdict = "winner" | "noResults" | "tired" | "expensive" | "steady";

export type VideoGalleryItem = {
  /** video_id de TikTok, `post:<item_id>` (Spark) o `ad:<ad_id>` si no hay ninguno. */
  key: string;
  videoId: string | null;
  tiktokItemId: string | null;
  /** Anunciante y anuncio con más gasto del video (para pedir la portada). */
  advertiserId: string;
  topAdId: string;
  name: string;
  adsCount: number;
  spend: number;
  impressions: number;
  results: number;
  /** CTR en % (1.25 = 1.25%). */
  ctr: number | null;
  costPerResult: number | null;
  /** Fracción de reproducciones que llega a 6 s (0–1). */
  hold6s: number | null;
  /** Costo por resultado del video ÷ el del cliente (menos es mejor). */
  vsAverage: number | null;
  verdict: VideoVerdict;
  lastDate: string;
};

export type VideoGallerySummary = {
  videos: VideoGalleryItem[];
  totals: { videos: number; spend: number; results: number; costPerResult: number | null };
  dataThrough: string | null;
};

/** Días finales del rango que se comparan con los anteriores para ver cansancio. */
export const RECENT_DAYS = 3;
const MIN_IMPRESSIONS_FOR_TREND = 1000;

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function shiftYmd(dateYmd: string, deltaDays: number): string {
  const base = new Date(`${dateYmd}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

type Acc = {
  key: string;
  videoId: string | null;
  tiktokItemId: string | null;
  name: string;
  nameDate: string;
  ads: Set<string>;
  spendByAdvertiser: Map<string, number>;
  spendByAd: Map<string, number>;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  plays: number;
  held6: number;
  recentImp: number;
  recentClicks: number;
  lastDate: string;
};

export function summarizeVideoGallery(rows: VideoDayRow[], opts: { limit?: number } = {}): VideoGallerySummary {
  let dataThrough: string | null = null;
  for (const row of rows) {
    if (!dataThrough || row.statDate > dataThrough) dataThrough = row.statDate;
  }
  const recentFrom = dataThrough ? shiftYmd(dataThrough, -(RECENT_DAYS - 1)) : "";

  const byVideo = new Map<string, Acc>();
  for (const row of rows) {
    if (!row.adId) continue;
    const videoId = row.videoId?.trim() || null;
    const itemId = row.tiktokItemId?.trim() || null;
    const key = videoId ?? (itemId ? `post:${itemId}` : `ad:${row.adId}`);
    const acc: Acc =
      byVideo.get(key) ??
      {
        key,
        videoId,
        tiktokItemId: itemId,
        name: row.adName || row.adId,
        nameDate: row.statDate,
        ads: new Set<string>(),
        spendByAdvertiser: new Map<string, number>(),
        spendByAd: new Map<string, number>(),
        spend: 0,
        impressions: 0,
        clicks: 0,
        results: 0,
        plays: 0,
        held6: 0,
        recentImp: 0,
        recentClicks: 0,
        lastDate: row.statDate,
      };
    const spend = row.spend || 0;
    acc.spendByAdvertiser.set(row.advertiserId, (acc.spendByAdvertiser.get(row.advertiserId) ?? 0) + spend);
    const adKey = `${row.advertiserId}:${row.adId}`;
    acc.ads.add(adKey);
    acc.spendByAd.set(adKey, (acc.spendByAd.get(adKey) ?? 0) + spend);
    acc.spend += spend;
    acc.impressions += row.impressions ?? 0;
    acc.clicks += row.clicks ?? 0;
    acc.results += row.results ?? 0;
    acc.plays += row.videoPlayActions ?? 0;
    acc.held6 += row.videoWatched6s ?? 0;
    if (row.statDate >= recentFrom) {
      acc.recentImp += row.impressions ?? 0;
      acc.recentClicks += row.clicks ?? 0;
    }
    if (row.statDate > acc.lastDate) acc.lastDate = row.statDate;
    // El nombre más reciente gana (el anuncio pudo renombrarse).
    if (row.adName && row.statDate >= acc.nameDate) {
      acc.name = row.adName;
      acc.nameDate = row.statDate;
    }
    byVideo.set(key, acc);
  }

  const accs = [...byVideo.values()].filter((a) => a.spend > 0);
  const totalSpend = accs.reduce((s, a) => s + a.spend, 0);
  const totalResults = accs.reduce((s, a) => s + a.results, 0);
  const avgCpr = totalResults > 0 ? totalSpend / totalResults : null;
  // Gasto mínimo para decir "sin ventas": 1.5 resultados al costo promedio, o USD 5.
  const noResultsSpend = Math.max(5, avgCpr != null ? avgCpr * 1.5 : 0);

  const videos = accs
    .map((a): VideoGalleryItem => {
      const costPerResult = a.results > 0 ? round(a.spend / a.results, 2) : null;
      const vsAverage = costPerResult != null && avgCpr ? round(a.spend / a.results / avgCpr, 2) : null;
      const earlierImp = a.impressions - a.recentImp;
      const earlierCtr = earlierImp > 0 ? (a.clicks - a.recentClicks) / earlierImp : null;
      const recentCtr = a.recentImp > 0 ? a.recentClicks / a.recentImp : null;
      const tired =
        earlierCtr != null &&
        recentCtr != null &&
        earlierImp >= MIN_IMPRESSIONS_FOR_TREND &&
        a.recentImp >= MIN_IMPRESSIONS_FOR_TREND &&
        recentCtr < earlierCtr * 0.7;

      let verdict: VideoVerdict = "steady";
      if (a.results <= 0 && a.spend >= noResultsSpend) verdict = "noResults";
      else if (a.results >= 2 && vsAverage != null && vsAverage <= 0.8) verdict = "winner";
      else if (tired) verdict = "tired";
      else if (vsAverage != null && vsAverage >= 1.4) verdict = "expensive";

      const advertiserId = [...a.spendByAdvertiser.entries()].sort((x, y) => y[1] - x[1])[0][0];
      const topAdId = [...a.spendByAd.entries()]
        .filter(([k]) => k.startsWith(`${advertiserId}:`))
        .sort((x, y) => y[1] - x[1])[0][0]
        .slice(advertiserId.length + 1);
      return {
        key: a.key,
        videoId: a.videoId,
        tiktokItemId: a.tiktokItemId,
        advertiserId,
        topAdId,
        name: a.name,
        adsCount: a.ads.size,
        spend: round(a.spend, 2),
        impressions: a.impressions,
        results: round(a.results, 2),
        ctr: a.impressions > 0 ? round((a.clicks / a.impressions) * 100, 2) : null,
        costPerResult,
        hold6s: a.plays > 0 ? round(a.held6 / a.plays, 3) : null,
        vsAverage,
        verdict,
        lastDate: a.lastDate,
      };
    })
    .sort((x, y) => y.spend - x.spend);

  return {
    videos: opts.limit ? videos.slice(0, opts.limit) : videos,
    totals: {
      videos: videos.length,
      spend: round(totalSpend, 2),
      results: round(totalResults, 2),
      costPerResult: avgCpr != null ? round(avgCpr, 2) : null,
    },
    dataThrough,
  };
}
