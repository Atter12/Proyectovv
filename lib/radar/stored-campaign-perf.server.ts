import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { shiftYmd } from "@/lib/hecom/gasto-date";
import {
  fetchCampaignPerformanceForAdvertisers,
  type TikTokCampaignPerfBundle,
} from "@/lib/integrations/tiktok/campaign-performance.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESYNC_DAYS } from "@/lib/radar/ad-daily-sync.server";
import {
  campaignPerfFromAdDays,
  coveredDays,
  rangeIsCovered,
  type CampaignAdDayRow,
} from "@/lib/radar/stored-campaign-perf";

/**
 * Rendimiento por campaña para Profit: desde radar_ad_daily cuando los
 * procesos diarios cubren todo el rango; si no, en vivo desde TikTok como
 * siempre. Así abrir Profit deja de gastar consultas del token compartido.
 */
async function loadStored(input: {
  advertiserIds: string[];
  from: string;
  to: string;
}): Promise<TikTokCampaignPerfBundle | null> {
  const admin = createAdminClient();

  const { data: runs, error: runsError } = await admin
    .from("radar_job_runs")
    .select("run_date")
    .eq("job", "ad-daily")
    .eq("status", "complete")
    .gte("run_date", input.from)
    .lte("run_date", shiftYmd(input.to, RESYNC_DAYS - 1));
  if (runsError) return null;
  const covered = coveredDays((runs ?? []).map((r) => String(r.run_date).slice(0, 10)), RESYNC_DAYS);
  if (!rangeIsCovered(input.from, input.to, covered)) return null;

  const rows: CampaignAdDayRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from("radar_ad_daily")
      .select("advertiser_id, campaign_id, campaign_name, stat_date, spend, impressions, clicks, conversions")
      .in("advertiser_id", input.advertiserIds)
      .gte("stat_date", input.from)
      .lte("stat_date", input.to)
      .range(offset, offset + 999);
    if (error) return null;
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      rows.push({
        advertiserId: String(r.advertiser_id),
        campaignId: (r.campaign_id as string | null) ?? null,
        campaignName: (r.campaign_name as string | null) ?? null,
        statDate: String(r.stat_date).slice(0, 10),
        spend: Number(r.spend ?? 0),
        impressions: r.impressions == null ? null : Number(r.impressions),
        clicks: r.clicks == null ? null : Number(r.clicks),
        conversions: r.conversions == null ? null : Number(r.conversions),
      });
    }
    if (!data || data.length < 1000) break;
  }

  return {
    rows: campaignPerfFromAdDays(rows),
    fetchedAt: new Date().toISOString(),
    advertisersQueried: input.advertiserIds.length,
    advertisersOk: input.advertiserIds.length,
    error: null,
  };
}

export async function fetchCampaignPerformancePreferStored(input: {
  advertiserIds: string[];
  from: string;
  to: string;
  maxAdvertisers?: number;
}): Promise<TikTokCampaignPerfBundle> {
  const ids = [...new Set(input.advertiserIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    input.maxAdvertisers ?? 12,
  );
  if (serverEnv.radarJobsEnabled && ids.length > 0) {
    const stored = await loadStored({ advertiserIds: ids, from: input.from, to: input.to }).catch(() => null);
    if (stored) return stored;
  }
  return fetchCampaignPerformanceForAdvertisers(input);
}
