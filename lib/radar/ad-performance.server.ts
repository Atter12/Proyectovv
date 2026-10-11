import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeAdPerformance, type AdDayRow, type AdPerformanceSummary } from "@/lib/radar/ad-performance";

/**
 * Rendimiento por anuncio del cliente en un rango, desde radar_ad_daily (lo
 * llena cada madrugada /api/jobs/radar/ad-daily). Profit lo lee de la base:
 * no consulta TikTok en cada visita.
 */
export async function loadClienteAdPerformance(input: {
  hecomClienteId: string;
  from: string;
  to: string;
}): Promise<AdPerformanceSummary> {
  const admin = createAdminClient();
  const rows: AdDayRow[] = [];

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from("radar_ad_daily")
      .select(
        "advertiser_id, ad_id, stat_date, ad_name, campaign_name, spend, impressions, clicks, results, video_play_actions, video_watched_2s, video_watched_6s",
      )
      .eq("hecom_cliente_id", input.hecomClienteId)
      .gte("stat_date", input.from)
      .lte("stat_date", input.to)
      .order("stat_date", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw new Error(`radar_ad_daily: ${error.message}`);
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const n = (v: unknown) => (v == null ? null : Number(v));
      rows.push({
        advertiserId: String(r.advertiser_id),
        adId: String(r.ad_id),
        statDate: String(r.stat_date).slice(0, 10),
        adName: (r.ad_name as string | null) ?? null,
        campaignName: (r.campaign_name as string | null) ?? null,
        spend: Number(r.spend ?? 0),
        impressions: n(r.impressions),
        clicks: n(r.clicks),
        results: n(r.results),
        videoPlayActions: n(r.video_play_actions),
        videoWatched2s: n(r.video_watched_2s),
        videoWatched6s: n(r.video_watched_6s),
      });
    }
    if (!data || data.length < 1000) break;
  }

  return summarizeAdPerformance(rows);
}
