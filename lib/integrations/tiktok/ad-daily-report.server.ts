import "server-only";
import {
  TikTokApiError,
  TikTokRateLimitError,
  tiktokRequest,
} from "@/lib/integrations/tiktok/http.server";
import { parseAdDailyList, type AdDailyRow } from "@/lib/radar/ad-daily-parse";

/**
 * Reporte de un día por anuncio (data_level=AUCTION_AD) de un anunciante.
 * Adaptado de campaign-performance.server.ts: si TikTok rechaza alguna métrica,
 * se reintenta con un conjunto más chico.
 */

const VIDEO_METRICS = ["video_play_actions", "video_watched_2s", "video_watched_6s", "average_video_play"];
const BASE_METRICS = ["spend", "impressions", "clicks", "ctr", "conversion", "cost_per_conversion"];

const METRIC_ATTEMPTS: string[][] = [
  [
    ...BASE_METRICS,
    "result",
    "cost_per_result",
    ...VIDEO_METRICS,
    "campaign_id",
    "campaign_name",
    "adgroup_id",
    "ad_name",
  ],
  [...BASE_METRICS, ...VIDEO_METRICS, "campaign_id", "campaign_name", "ad_name"],
  [...BASE_METRICS, ...VIDEO_METRICS],
];

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

type ReportPage = {
  list?: unknown[];
  page_info?: { total_page?: number };
};

export async function fetchAdDailyReport(input: {
  accessToken: string;
  advertiserId: string;
  /** YYYY-MM-DD en la zona horaria de la cuenta. */
  date: string;
}): Promise<AdDailyRow[]> {
  let lastError: TikTokApiError | null = null;

  for (const metrics of METRIC_ATTEMPTS) {
    try {
      const rows: AdDailyRow[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const data = await tiktokRequest<ReportPage>({
          path: "/report/integrated/get/",
          accessToken: input.accessToken,
          query: {
            advertiser_id: input.advertiserId,
            service_type: "AUCTION",
            report_type: "BASIC",
            data_level: "AUCTION_AD",
            dimensions: ["ad_id", "stat_time_day"],
            metrics,
            start_date: input.date,
            end_date: input.date,
            page: String(page),
            page_size: String(PAGE_SIZE),
          },
        });
        rows.push(...parseAdDailyList(input.advertiserId, data.list, input.date));
        const totalPage = Number(data.page_info?.total_page ?? page);
        if (!Array.isArray(data.list) || data.list.length === 0 || page >= totalPage) break;
      }
      return rows;
    } catch (error) {
      if (error instanceof TikTokRateLimitError) throw error;
      if (!(error instanceof TikTokApiError)) throw error;
      lastError = error;
    }
  }

  throw lastError ?? new Error("Reporte por anuncio de TikTok falló.");
}

/**
 * Video de cada anuncio (para enlazar métricas con el creativo).
 * GET /ad/get/ filtrando por ad_ids (máx. 100 por consulta).
 */
export async function fetchAdVideoIds(input: {
  accessToken: string;
  advertiserId: string;
  adIds: string[];
}): Promise<Map<string, { videoId: string | null; tiktokItemId: string | null }>> {
  const out = new Map<string, { videoId: string | null; tiktokItemId: string | null }>();
  const ids = [...new Set(input.adIds.map((id) => id.trim()).filter(Boolean))];

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const data = await tiktokRequest<{ list?: Array<Record<string, unknown>> }>({
      path: "/ad/get/",
      accessToken: input.accessToken,
      query: {
        advertiser_id: input.advertiserId,
        filtering: { ad_ids: chunk },
        fields: ["ad_id", "video_id", "tiktok_item_id"],
        page: "1",
        page_size: "100",
      },
    });
    for (const row of data.list ?? []) {
      const adId = String(row.ad_id ?? "").trim();
      if (!adId) continue;
      out.set(adId, {
        videoId: String(row.video_id ?? "").trim() || null,
        tiktokItemId: String(row.tiktok_item_id ?? "").trim() || null,
      });
    }
  }

  return out;
}
