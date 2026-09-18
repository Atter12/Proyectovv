import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";

type TikTokApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

export type TikTokListedAd = {
  adId: string;
  adName: string;
  campaignId: string | null;
  adgroupId: string | null;
  secondaryStatus: string | null;
  operationStatus: string | null;
  videoId: string | null;
  imageIds: string[];
  smartPlusAdId: string | null;
  campaignAutomationType: string | null;
};

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function tiktokGet<T>(input: {
  path: string;
  accessToken: string;
  query: Record<string, string>;
}): Promise<TikTokApiResponse<T>> {
  const url = new URL(apiUrl(input.path));
  for (const [key, value] of Object.entries(input.query)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Access-Token": input.accessToken,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  return (await response.json()) as TikTokApiResponse<T>;
}

function mapAdRow(row: Record<string, unknown>): TikTokListedAd | null {
  const adId = String(row.ad_id ?? row.id ?? "").trim();
  if (!adId) return null;
  const imageRaw = row.image_ids ?? row.image_id;
  const imageIds = Array.isArray(imageRaw)
    ? imageRaw.map((id) => String(id ?? "").trim()).filter(Boolean)
    : typeof imageRaw === "string" && imageRaw.trim()
      ? [imageRaw.trim()]
      : [];
  return {
    adId,
    adName: String(row.ad_name ?? row.name ?? adId).trim() || adId,
    campaignId: String(row.campaign_id ?? "").trim() || null,
    adgroupId: String(row.adgroup_id ?? "").trim() || null,
    secondaryStatus:
      typeof row.secondary_status === "string" && row.secondary_status.trim()
        ? row.secondary_status.trim()
        : null,
    operationStatus:
      typeof row.operation_status === "string" && row.operation_status.trim()
        ? row.operation_status.trim()
        : null,
    videoId: String(row.video_id ?? "").trim() || null,
    imageIds,
    smartPlusAdId: String(row.smart_plus_ad_id ?? "").trim() || null,
    campaignAutomationType:
      String(row.campaign_automation_type ?? "").trim() || null,
  };
}

import { looksLikeRejectedAdStatus } from "@/lib/creatives/tiktok-reject-action";
import {
  findNestedVideoId,
  mapTikTokMediaPreviewRows,
  type TikTokMediaPreview,
} from "@/lib/creatives/tiktok-media-preview";

/** Heurística: secondary_status sugiere rechazo / no entrega por review. */
export { looksLikeRejectedAdStatus };

/**
 * Lista anuncios del advertiser (paginado).
 * GET /open_api/v1.3/ad/get/
 */
export async function listAdvertiserAds(input: {
  organizationId?: string;
  advertiserId: string;
  /** Máx páginas (page_size 50). Default 6 ≈ 300 ads. */
  maxPages?: number;
  pageSize?: number;
  /** Si se pasa, filtra por secondary_status exacto (TikTok). */
  secondaryStatus?: string | null;
}): Promise<TikTokListedAd[]> {
  const advertiserId = input.advertiserId.trim();
  if (!advertiserId) return [];

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 50, 100));
  const maxPages = Math.max(1, Math.min(input.maxPages ?? 6, 20));
  const out: TikTokListedAd[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const filtering: Record<string, unknown> = {
      primary_status: "STATUS_NOT_DELETE",
    };
    if (input.secondaryStatus?.trim()) {
      filtering.secondary_status = input.secondaryStatus.trim();
    }

    const json = await tiktokGet<{
      list?: Array<Record<string, unknown>>;
      page_info?: { total_page?: number; page?: number };
    }>({
      path: "/ad/get/",
      accessToken: token,
      query: {
        advertiser_id: advertiserId,
        filtering: JSON.stringify(filtering),
        fields: JSON.stringify([
          "ad_id",
          "ad_name",
          "campaign_id",
          "adgroup_id",
          "secondary_status",
          "operation_status",
          "video_id",
          "image_ids",
          "smart_plus_ad_id",
          "campaign_automation_type",
        ]),
        page: String(page),
        page_size: String(pageSize),
      },
    });

    if (json.code !== undefined && json.code !== 0) {
      throw new Error(
        json.message ?? `TikTok ad/get falló (code=${json.code}).`,
      );
    }

    const list = json.data?.list ?? [];
    for (const row of list) {
      const mapped = mapAdRow(row);
      if (mapped) out.push(mapped);
    }

    const totalPage = Number(json.data?.page_info?.total_page ?? page);
    if (list.length === 0 || page >= totalPage) break;
  }

  return out;
}

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

/**
 * Cover + preview de videos/imágenes ya subidos a TikTok.
 * No lanza: si falla, el anuncio se muestra igual sin miniatura.
 */
export async function fetchAdMediaPreviews(input: {
  organizationId?: string;
  advertiserId: string;
  videoIds: string[];
  imageIds: string[];
}): Promise<Map<string, TikTokMediaPreview>> {
  const advertiserId = input.advertiserId.trim();
  const videoIds = [...new Set(input.videoIds.map((id) => id.trim()).filter(Boolean))];
  const imageIds = [...new Set(input.imageIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, TikTokMediaPreview>();
  if (!advertiserId || (videoIds.length === 0 && imageIds.length === 0)) {
    return out;
  }

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);

  async function pull(path: string, key: string, ids: string[]) {
    for (const chunk of chunkIds(ids, 20)) {
      try {
        const json = await tiktokGet<{ list?: unknown }>({
          path,
          accessToken: token,
          query: {
            advertiser_id: advertiserId,
            [key]: JSON.stringify(chunk),
          },
        });
        if (json.code !== undefined && json.code !== 0) continue;
        for (const [id, preview] of mapTikTokMediaPreviewRows(json.data?.list)) {
          out.set(id, preview);
        }
      } catch {
        /* miniatura opcional */
      }
    }
  }

  await pull("/file/video/ad/info/", "video_ids", videoIds);
  await pull("/file/image/ad/info/", "image_ids", imageIds);
  return out;
}

/** Smart+ guarda el video dentro de creative_list, no en ad/get. */
export async function fetchSmartPlusVideoIds(input: {
  organizationId?: string;
  advertiserId: string;
  smartPlusAdIds: string[];
}): Promise<Map<string, string>> {
  const advertiserId = input.advertiserId.trim();
  const ids = [
    ...new Set(input.smartPlusAdIds.map((id) => id.trim()).filter(Boolean)),
  ];
  const out = new Map<string, string>();
  if (!advertiserId || ids.length === 0) return out;

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  for (const chunk of chunkIds(ids, 20)) {
    try {
      const json = await tiktokGet<{ list?: Array<Record<string, unknown>> }>({
        path: "/smart_plus/ad/get/",
        accessToken: token,
        query: {
          advertiser_id: advertiserId,
          filtering: JSON.stringify({ smart_plus_ad_ids: chunk }),
          page: "1",
          page_size: String(Math.max(chunk.length, 1)),
        },
      });
      if (json.code !== undefined && json.code !== 0) continue;
      for (const row of json.data?.list ?? []) {
        const spId = String(row.smart_plus_ad_id ?? row.ad_id ?? "").trim();
        const videoId = findNestedVideoId(row);
        if (spId && videoId) out.set(spId, videoId);
      }
    } catch {
      /* la portada es opcional */
    }
  }
  return out;
}
