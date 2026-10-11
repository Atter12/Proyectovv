/**
 * Lectura de las respuestas de la Discovery API de TikTok (sin dependencias, para tests).
 *
 * GET /discovery/trending_list/ → top 200 hashtags por categoría y país.
 * GET /discovery/video_list/    → top 20 videos por hashtag (máx. 10 hashtags por consulta).
 */

export type TrendingHashtag = {
  hashtagId: string;
  hashtagName: string;
  rankPosition: number | null;
  rankChange: string | null;
  views: number | null;
  posts: number | null;
  /** Países donde el hashtag está en el top; vacío si TikTok no lo envió. */
  topCountries: string[];
};

export type DiscoveredVideo = {
  videoId: string;
  shareUrl: string;
  embedUrl: string | null;
  hashtagId: string;
  hashtagName: string;
  /** Posición del video dentro del top del hashtag (1 = mejor). */
  rank: number;
};

/** Máximo de hashtags que acepta /discovery/video_list/ por consulta. */
export const VIDEO_LIST_MAX_HASHTAGS = 10;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function parseCountries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    const record = asRecord(item);
    const code = toText(record ? (record.country_code ?? record.code ?? record.country) : item).toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) out.add(code);
  }
  return [...out];
}

export function parseTrendingList(data: unknown): TrendingHashtag[] {
  const list = asRecord(data)?.list;
  if (!Array.isArray(list)) return [];
  const out: TrendingHashtag[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const hashtagId = toText(row.hashtag_id);
    const hashtagName = toText(row.hashtag_name).replace(/^#/, "");
    if (!hashtagId || !hashtagName || seen.has(hashtagId)) continue;
    seen.add(hashtagId);
    out.push({
      hashtagId,
      hashtagName,
      rankPosition: toNumber(row.rank_position),
      rankChange: toText(row.rank_change) || null,
      views: toNumber(row.views),
      posts: toNumber(row.posts),
      topCountries: parseCountries(row.top_country_list),
    });
  }
  return out;
}

/**
 * Hashtags que se pueden consultar en video_list para un país: TikTok solo
 * acepta países que estén en el top_country_list del hashtag. Si no envió esa
 * lista, se intenta igual. Ordena por mejor posición.
 */
export function pickHashtagsForVideoList(
  hashtags: TrendingHashtag[],
  countryCode: string,
  max: number = VIDEO_LIST_MAX_HASHTAGS,
): TrendingHashtag[] {
  const country = countryCode.trim().toUpperCase();
  const limit = Math.max(0, Math.min(max, VIDEO_LIST_MAX_HASHTAGS));
  return hashtags
    .filter((h) => h.topCountries.length === 0 || h.topCountries.includes(country))
    .sort((a, b) => (a.rankPosition ?? Number.MAX_SAFE_INTEGER) - (b.rankPosition ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit);
}

export function parseVideoList(data: unknown): DiscoveredVideo[] {
  const list = asRecord(data)?.list;
  if (!Array.isArray(list)) return [];
  const out: DiscoveredVideo[] = [];
  for (const item of list) {
    const group = asRecord(item);
    if (!group) continue;
    const hashtagId = toText(group.hashtag_id);
    const hashtagName = toText(group.hashtag_name).replace(/^#/, "");
    const videos = Array.isArray(group.top_video_list) ? group.top_video_list : [];
    let rank = 0;
    for (const v of videos) {
      const video = asRecord(v);
      rank += 1;
      if (!video) continue;
      const videoId = toText(video.video_id);
      const shareUrl = toText(video.share_url);
      if (!videoId || !shareUrl) continue;
      out.push({
        videoId,
        shareUrl,
        embedUrl: toText(video.embed_url) || null,
        hashtagId,
        hashtagName,
        rank,
      });
    }
  }
  return out;
}

/** "https://www.tiktok.com/@tienda.pe/video/123" → "tienda.pe". */
export function authorHandleFromShareUrl(url: string | null | undefined): string | null {
  const match = String(url ?? "").match(/tiktok\.com\/@([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]!) : null;
}
