import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { fetchAdMediaPreviews, fetchSmartPlusVideoIds } from "@/lib/integrations/tiktok/ad-list.server";
import { fetchAdVideoIds } from "@/lib/integrations/tiktok/ad-daily-report.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import type { TikTokMediaPreview } from "@/lib/creatives/tiktok-media-preview";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import {
  summarizeVideoGallery,
  type VideoDayRow,
  type VideoGalleryItem,
  type VideoGallerySummary,
} from "@/lib/radar/video-gallery";

/** Días que mira la galería, terminando ayer (Lima). */
export const VIDEO_GALLERY_DAYS = 14;

export type VideoGalleryData = VideoGallerySummary & {
  from: string;
  to: string;
  /** Por `key` del video. */
  previews: Record<string, GalleryPreview>;
};

export type GalleryPreview = TikTokMediaPreview & {
  /** Publicación en TikTok (anuncios Spark). */
  postUrl: string | null;
};

/**
 * Videos del cliente con su rendimiento de los últimos días. Lee las métricas
 * de radar_ad_daily (job de cada madrugada) y solo consulta TikTok para las
 * portadas de los videos que se muestran.
 */
export async function loadClienteVideoGallery(input: {
  hecomClienteId: string;
  organizationId?: string;
  limit?: number;
}): Promise<VideoGalleryData> {
  const cacheKey = `${input.hecomClienteId}:${input.limit ?? 12}`;
  const hit = galleryCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data;
  const data = await buildClienteVideoGallery(input);
  galleryCache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

/**
 * Los datos cambian una vez al día (job de madrugada) y armar la galería pide
 * varias consultas a TikTok: se guarda un rato por instancia del servidor.
 */
const CACHE_TTL_MS = 15 * 60_000;
const galleryCache = new Map<string, { data: VideoGalleryData; expires: number }>();

async function buildClienteVideoGallery(input: {
  hecomClienteId: string;
  organizationId?: string;
  limit?: number;
}): Promise<VideoGalleryData> {
  const to = shiftYmd(todayYmdInTz(), -1);
  const from = shiftYmd(to, -(VIDEO_GALLERY_DAYS - 1));
  const admin = createAdminClient();
  const rows: VideoDayRow[] = [];

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from("radar_ad_daily")
      .select(
        "advertiser_id, ad_id, video_id, tiktok_item_id, stat_date, ad_name, spend, impressions, clicks, results, video_play_actions, video_watched_6s",
      )
      .eq("hecom_cliente_id", input.hecomClienteId)
      .gte("stat_date", from)
      .lte("stat_date", to)
      .order("stat_date", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw new Error(`radar_ad_daily: ${error.message}`);
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const n = (v: unknown) => (v == null ? null : Number(v));
      rows.push({
        advertiserId: String(r.advertiser_id),
        adId: String(r.ad_id),
        videoId: (r.video_id as string | null) ?? null,
        tiktokItemId: (r.tiktok_item_id as string | null) ?? null,
        statDate: String(r.stat_date).slice(0, 10),
        adName: (r.ad_name as string | null) ?? null,
        spend: Number(r.spend ?? 0),
        impressions: n(r.impressions),
        clicks: n(r.clicks),
        results: n(r.results),
        videoPlayActions: n(r.video_play_actions),
        videoWatched6s: n(r.video_watched_6s),
      });
    }
    if (!data || data.length < 1000) break;
  }

  await fillMissingVideoIds(rows, input.organizationId);
  const summary = summarizeVideoGallery(rows, { limit: input.limit ?? 12 });

  // Portadas: una consulta por anunciante; si falla, la tarjeta sale sin imagen.
  const byAdvertiser = new Map<string, string[]>();
  for (const v of summary.videos) {
    if (!v.videoId) continue;
    byAdvertiser.set(v.advertiserId, [...(byAdvertiser.get(v.advertiserId) ?? []), v.videoId]);
  }
  const previews: Record<string, GalleryPreview> = {};
  await Promise.all([
    ...[...byAdvertiser.entries()].map(async ([advertiserId, videoIds]) => {
      try {
        const map = await fetchAdMediaPreviews({
          organizationId: input.organizationId,
          advertiserId,
          videoIds,
          imageIds: [],
        });
        for (const [id, preview] of map) previews[id] = { ...preview, postUrl: null };
      } catch {
        /* portada opcional */
      }
    }),
    fetchSparkPreviews(summary.videos, input.organizationId).then((map) => {
      for (const [key, preview] of map) previews[key] = preview;
    }),
  ]);

  return { ...summary, from, to, previews };
}

/** Anuncios con más gasto a los que se les busca el video si falta. */
const MAX_LOOKUP_ADS = 80;

/**
 * Los anuncios Smart+ no traen video_id en el reporte: se busca en vivo solo
 * para los de más gasto (ad/get y, si no aparece, smart_plus/ad/get).
 * Si TikTok falla, el anuncio queda como está (sin portada).
 */
async function fillMissingVideoIds(rows: VideoDayRow[], organizationId?: string): Promise<void> {
  const spendByAd = new Map<string, { advertiserId: string; adId: string; spend: number }>();
  for (const r of rows) {
    // Spark: se muestra por su publicación, no necesita video_id.
    if (r.videoId || r.tiktokItemId) continue;
    const key = `${r.advertiserId}:${r.adId}`;
    const acc = spendByAd.get(key) ?? { advertiserId: r.advertiserId, adId: r.adId, spend: 0 };
    acc.spend += r.spend;
    spendByAd.set(key, acc);
  }
  const top = [...spendByAd.values()].sort((a, b) => b.spend - a.spend).slice(0, MAX_LOOKUP_ADS);
  if (top.length === 0) return;

  const byAdvertiser = new Map<string, string[]>();
  for (const ad of top) byAdvertiser.set(ad.advertiserId, [...(byAdvertiser.get(ad.advertiserId) ?? []), ad.adId]);

  const found = new Map<string, string>();
  let token: string;
  try {
    ({ token } = await resolveTikTokFinanceAccessToken(organizationId));
  } catch {
    return;
  }
  await Promise.all(
    [...byAdvertiser.entries()].map(async ([advertiserId, adIds]) => {
      try {
        const classic = await fetchAdVideoIds({ accessToken: token, advertiserId, adIds });
        for (const [adId, v] of classic) if (v.videoId) found.set(`${advertiserId}:${adId}`, v.videoId);
      } catch {
        /* sigue con Smart+ */
      }
      const pending = adIds.filter((id) => !found.has(`${advertiserId}:${id}`));
      if (pending.length === 0) return;
      const smart = await fetchSmartPlusVideoIds({ organizationId, advertiserId, smartPlusAdIds: pending });
      for (const [adId, videoId] of smart) found.set(`${advertiserId}:${adId}`, videoId);
    }),
  );

  for (const r of rows) {
    if (!r.videoId) r.videoId = found.get(`${r.advertiserId}:${r.adId}`) ?? null;
  }
}

type IdentityRef = { identityType: string; identityId: string; bcId: string | null };

/**
 * Anuncios Spark: la portada y el mp4 salen de /identity/video/info/ con la
 * identidad (cuenta de TikTok) del anuncio. Las identidades autorizadas por un
 * BC necesitan además el id de ese BC (/identity/get/). Nada de esto lanza.
 */
async function fetchSparkPreviews(
  videos: VideoGalleryItem[],
  organizationId?: string,
): Promise<Map<string, GalleryPreview>> {
  const out = new Map<string, GalleryPreview>();
  const spark = videos.filter((v) => !v.videoId && v.tiktokItemId);
  if (spark.length === 0) return out;
  for (const v of spark) {
    out.set(v.key, {
      posterUrl: null,
      previewUrl: null,
      postUrl: `https://www.tiktok.com/@_/video/${v.tiktokItemId}`,
    });
  }

  let token: string;
  try {
    ({ token } = await resolveTikTokFinanceAccessToken(organizationId));
  } catch {
    return out;
  }

  const byAdvertiser = new Map<string, VideoGalleryItem[]>();
  for (const v of spark) byAdvertiser.set(v.advertiserId, [...(byAdvertiser.get(v.advertiserId) ?? []), v]);

  await Promise.all(
    [...byAdvertiser.entries()].map(async ([advertiserId, items]) => {
      try {
        const ads = await tiktokRequest<{ list?: Array<Record<string, unknown>> }>({
          path: "/ad/get/",
          accessToken: token,
          query: {
            advertiser_id: advertiserId,
            filtering: { ad_ids: items.map((v) => v.topAdId) },
            fields: ["ad_id", "identity_id", "identity_type"],
            page: "1",
            page_size: "100",
          },
        });
        const identityByAd = new Map<string, IdentityRef>();
        for (const row of ads.list ?? []) {
          const identityId = String(row.identity_id ?? "").trim();
          const identityType = String(row.identity_type ?? "").trim();
          if (identityId && identityType) {
            identityByAd.set(String(row.ad_id), { identityId, identityType, bcId: null });
          }
        }

        if ([...identityByAd.values()].some((i) => i.identityType === "BC_AUTH_TT")) {
          const ids = await tiktokRequest<{ identity_list?: Array<Record<string, unknown>> }>({
            path: "/identity/get/",
            accessToken: token,
            query: { advertiser_id: advertiserId, identity_type: "BC_AUTH_TT", page_size: "100" },
          });
          const bcByIdentity = new Map(
            (ids.identity_list ?? []).map((i) => [String(i.identity_id), String(i.identity_authorized_bc_id ?? "") || null]),
          );
          for (const ref of identityByAd.values()) ref.bcId = bcByIdentity.get(ref.identityId) ?? null;
        }

        await Promise.all(
          items.map(async (v) => {
            const ref = identityByAd.get(v.topAdId);
            if (!ref) return;
            try {
              const info = await tiktokRequest<{
                video_detail?: { video_info?: { poster_url?: string; preview_url?: string } };
              }>({
                path: "/identity/video/info/",
                accessToken: token,
                query: {
                  advertiser_id: advertiserId,
                  identity_type: ref.identityType,
                  identity_id: ref.identityId,
                  item_id: v.tiktokItemId,
                  ...(ref.bcId ? { identity_authorized_bc_id: ref.bcId } : {}),
                },
              });
              const video = info.video_detail?.video_info;
              const current = out.get(v.key)!;
              out.set(v.key, {
                ...current,
                posterUrl: video?.poster_url?.trim() || null,
                previewUrl: video?.preview_url?.trim() || null,
              });
            } catch {
              /* publicación borrada o sin permiso: queda el enlace */
            }
          }),
        );
      } catch {
        /* portada opcional */
      }
    }),
  );
  return out;
}
