/**
 * Lectura del reporte diario por anuncio de TikTok (data_level=AUCTION_AD) y
 * mapeo anunciante → cliente Hecom (sin dependencias, para tests).
 */

export type AdDailyRow = {
  advertiserId: string;
  adId: string;
  statDate: string;
  campaignId: string | null;
  campaignName: string | null;
  adgroupId: string | null;
  adName: string | null;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  /** CTR en % (1.25 = 1.25%). */
  ctr: number | null;
  conversions: number | null;
  costPerConversion: number | null;
  results: number | null;
  costPerResult: number | null;
  videoPlayActions: number | null;
  videoWatched2s: number | null;
  videoWatched6s: number | null;
  averageVideoPlay: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown): number | null {
  if (value == null || value === "" || value === "-") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function int(value: unknown): number | null {
  const n = num(value);
  return n == null ? null : Math.round(n);
}

function text(value: unknown): string | null {
  const s = value == null ? "" : String(value).trim();
  return s && s !== "-" ? s : null;
}

function round(n: number | null, digits: number): number | null {
  if (n == null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Filas del reporte → filas de radar_ad_daily. Descarta anuncios sin gasto ni
 * impresiones (TikTok a veces devuelve filas vacías).
 */
export function parseAdDailyList(
  advertiserId: string,
  list: unknown,
  fallbackDate: string,
): AdDailyRow[] {
  if (!Array.isArray(list)) return [];
  const out: AdDailyRow[] = [];
  for (const item of list) {
    const row = asRecord(item);
    const dims = asRecord(row.dimensions);
    const m = asRecord(row.metrics);
    const adId = text(dims.ad_id ?? m.ad_id);
    if (!adId) continue;
    const spend = num(m.spend) ?? 0;
    const impressions = int(m.impressions);
    if (spend <= 0 && (impressions ?? 0) <= 0) continue;
    const day = text(dims.stat_time_day)?.slice(0, 10) ?? fallbackDate;
    out.push({
      advertiserId,
      adId,
      statDate: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : fallbackDate,
      campaignId: text(m.campaign_id ?? dims.campaign_id),
      campaignName: text(m.campaign_name),
      adgroupId: text(m.adgroup_id ?? dims.adgroup_id),
      adName: text(m.ad_name),
      spend: round(spend, 2)!,
      impressions,
      clicks: int(m.clicks),
      ctr: round(num(m.ctr), 4),
      conversions: round(num(m.conversion), 2),
      costPerConversion: round(num(m.cost_per_conversion), 4),
      results: round(num(m.result), 2),
      costPerResult: round(num(m.cost_per_result), 4),
      videoPlayActions: int(m.video_play_actions),
      videoWatched2s: int(m.video_watched_2s),
      videoWatched6s: int(m.video_watched_6s),
      averageVideoPlay: round(num(m.average_video_play), 3),
    });
  }
  return out;
}

/**
 * Anunciante → cliente Hecom. Si dos clientes reclaman la misma cuenta, no se
 * adivina: se deja fuera y se reporta (misma regla que el sync de gasto).
 */
export function mapAdvertisersToClientes(
  rows: Array<{ advertiserId: string | null; hecomClienteId: string | null }>,
): { byAdvertiser: Map<string, string>; conflicts: string[] } {
  const owners = new Map<string, Set<string>>();
  for (const row of rows) {
    const advertiserId = String(row.advertiserId ?? "").trim();
    const clienteId = String(row.hecomClienteId ?? "").trim();
    if (!advertiserId || !clienteId) continue;
    const set = owners.get(advertiserId) ?? new Set<string>();
    set.add(clienteId);
    owners.set(advertiserId, set);
  }
  const byAdvertiser = new Map<string, string>();
  const conflicts: string[] = [];
  for (const [advertiserId, set] of owners) {
    if (set.size === 1) byAdvertiser.set(advertiserId, [...set][0]!);
    else conflicts.push(advertiserId);
  }
  return { byAdvertiser, conflicts };
}
