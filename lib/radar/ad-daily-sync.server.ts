import "server-only";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { fetchAdDailyReport, fetchAdVideoIds } from "@/lib/integrations/tiktok/ad-daily-report.server";
import { TikTokApiError, TikTokRateLimitError } from "@/lib/integrations/tiktok/http.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientAdvertisers } from "@/lib/radar/advertisers.server";
import { chunk, forEachUntil, loadJobRun, saveJobRun } from "@/lib/radar/job-runs.server";
import type { AdDailyRow } from "@/lib/radar/ad-daily-parse";

/**
 * Proceso diario: métricas de un día por anuncio de todas las cuentas de
 * clientes → radar_ad_daily. Reanudable: guarda en radar_job_runs qué
 * anunciantes ya terminó.
 */

const CONCURRENCY = 3;

export type AdDailySyncResult = {
  date: string;
  status: "complete" | "partial" | "skipped";
  advertisersTotal: number;
  advertisersDone: number;
  advertisersPending: number;
  rowsWritten: number;
  conflicts: string[];
  errors: Array<{ advertiserId: string; error: string }>;
  stoppedByRateLimit: boolean;
};

function toDbRow(row: AdDailyRow, hecomClienteId: string, video?: { videoId: string | null; tiktokItemId: string | null }) {
  return {
    advertiser_id: row.advertiserId,
    ad_id: row.adId,
    stat_date: row.statDate,
    hecom_cliente_id: hecomClienteId,
    campaign_id: row.campaignId,
    campaign_name: row.campaignName,
    adgroup_id: row.adgroupId,
    ad_name: row.adName,
    video_id: video?.videoId ?? null,
    tiktok_item_id: video?.tiktokItemId ?? null,
    spend: row.spend,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.ctr,
    conversions: row.conversions,
    cost_per_conversion: row.costPerConversion,
    results: row.results,
    cost_per_result: row.costPerResult,
    video_play_actions: row.videoPlayActions,
    video_watched_2s: row.videoWatched2s,
    video_watched_6s: row.videoWatched6s,
    average_video_play: row.averageVideoPlay,
    fetched_at: new Date().toISOString(),
  };
}

export async function runAdDailySync(input: {
  date: string;
  deadlineMs: number;
  /** Rehacer el día aunque ya esté completo. */
  force?: boolean;
  /** Solo estos anunciantes (pruebas). */
  onlyAdvertiserIds?: string[];
}): Promise<AdDailySyncResult> {
  const previous = await loadJobRun("ad-daily", input.date);
  if (previous?.status === "complete" && !input.force && !input.onlyAdvertiserIds?.length) {
    return {
      date: input.date,
      status: "skipped",
      advertisersTotal: Number(previous.stats.advertisersTotal ?? 0),
      advertisersDone: Number(previous.stats.advertisersDone ?? 0),
      advertisersPending: 0,
      rowsWritten: 0,
      conflicts: [],
      errors: [],
      stoppedByRateLimit: false,
    };
  }

  const { byAdvertiser, conflicts } = await loadClientAdvertisers();
  const only = new Set((input.onlyAdvertiserIds ?? []).map((id) => id.trim()).filter(Boolean));
  const done = new Set(input.force ? [] : (previous?.cursor.done ?? []));
  const all = [...byAdvertiser.keys()].filter((id) => only.size === 0 || only.has(id));
  const pending = all.filter((id) => !done.has(id));

  const { token } = await resolveTikTokFinanceAccessToken();
  const admin = createAdminClient();
  const errors: AdDailySyncResult["errors"] = [];
  let rowsWritten = 0;
  let stoppedByRateLimit = false;

  try {
    await forEachUntil(pending, CONCURRENCY, input.deadlineMs, async (advertiserId) => {
      try {
        const rows = await fetchAdDailyReport({ accessToken: token, advertiserId, date: input.date });
        if (rows.length > 0) {
          const videos = await fetchAdVideoIds({
            accessToken: token,
            advertiserId,
            adIds: rows.map((r) => r.adId),
          }).catch(() => new Map<string, { videoId: string | null; tiktokItemId: string | null }>());
          const hecomClienteId = byAdvertiser.get(advertiserId)!;
          for (const part of chunk(rows, 500)) {
            const { error } = await admin
              .from("radar_ad_daily")
              .upsert(
                part.map((r) => toDbRow(r, hecomClienteId, videos.get(r.adId))),
                { onConflict: "advertiser_id,ad_id,stat_date" },
              );
            if (error) throw new Error(`radar_ad_daily: ${error.message}`);
          }
          rowsWritten += rows.length;
        }
        done.add(advertiserId);
      } catch (error) {
        // Una cuenta que TikTok rechaza (suspendida, sin permiso) no frena al
        // resto. Los límites y los fallos de la base sí detienen la corrida.
        if (error instanceof TikTokRateLimitError || !(error instanceof TikTokApiError)) throw error;
        errors.push({
          advertiserId,
          error: error instanceof Error ? error.message : "Error desconocido",
        });
        done.add(advertiserId);
      }
    });
  } catch (error) {
    if (!(error instanceof TikTokRateLimitError)) {
      // Guardar lo avanzado antes de propagar, para no repetirlo al reintentar.
      if (only.size === 0) {
        await saveJobRun("ad-daily", input.date, {
          status: "failed",
          cursor: { done: [...done] },
          stats: { error: error instanceof Error ? error.message : "error" },
        }).catch(() => undefined);
      }
      throw error;
    }
    stoppedByRateLimit = true;
    console.warn("[radar] ad_daily_rate_limited", { date: input.date, done: done.size });
  }

  const remaining = all.filter((id) => !done.has(id));
  const status = remaining.length === 0 ? "complete" : "partial";
  const stats = {
    advertisersTotal: all.length,
    advertisersDone: all.length - remaining.length,
    rowsWrittenLastRun: rowsWritten,
    errors: errors.length,
    stoppedByRateLimit,
  };
  // Una corrida de prueba con ?advertiser_ids= no debe marcar el día como completo.
  if (only.size === 0) {
    await saveJobRun("ad-daily", input.date, { status, cursor: { done: [...done] }, stats });
  }
  console.info("[radar] ad_daily_run", { date: input.date, status, ...stats });

  return {
    date: input.date,
    status,
    advertisersTotal: all.length,
    advertisersDone: all.length - remaining.length,
    advertisersPending: remaining.length,
    rowsWritten,
    conflicts,
    errors: errors.slice(0, 20),
    stoppedByRateLimit,
  };
}
