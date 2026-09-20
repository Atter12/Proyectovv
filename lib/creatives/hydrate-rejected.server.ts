import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAdMediaPreviews,
  fetchSmartPlusCreativeMeta,
} from "@/lib/integrations/tiktok/ad-list.server";
import { normalizeMediaUrls } from "@/lib/creatives/tiktok-media-preview";
import type { CreativeDraftListItem } from "@/lib/creatives/types";

/** Trae video y texto de TikTok para las filas que se van a mostrar. */
export async function hydrateRejectedCards(
  organizationId: string,
  drafts: CreativeDraftListItem[],
): Promise<CreativeDraftListItem[]> {
  const targets = drafts.filter(
    (d) => d.status === "published" && d.tiktokReviewStatus === "rejected",
  );
  if (targets.length === 0) return drafts;

  const byAdvertiser = new Map<string, CreativeDraftListItem[]>();
  for (const draft of targets) {
    const advertiser = draft.externalAdvertiserId?.trim();
    if (!advertiser) continue;
    const list = byAdvertiser.get(advertiser) ?? [];
    list.push(draft);
    byAdvertiser.set(advertiser, list);
  }

  const admin = createAdminClient();

  for (const [advertiserId, rows] of byAdvertiser) {
    const adIds = rows
      .map((row) => row.externalAdId)
      .filter((id): id is string => Boolean(id));
    const meta = await fetchSmartPlusCreativeMeta({
      organizationId,
      advertiserId,
      smartPlusAdIds: adIds,
    }).catch(() => new Map());

    const videoIds = rows
      .map((row) => {
        const fromMeta = row.externalAdId
          ? meta.get(row.externalAdId)?.videoId
          : null;
        return fromMeta || row.videoId;
      })
      .filter((id): id is string => Boolean(id));

    const previews = await fetchAdMediaPreviews({
      organizationId,
      advertiserId,
      videoIds,
      imageIds: [],
    }).catch(() => new Map());

    await Promise.all(
      rows.map(async (row) => {
        const extra = row.externalAdId ? meta.get(row.externalAdId) : undefined;
        const videoId = extra?.videoId || row.videoId;
        const raw = videoId ? previews.get(videoId) : undefined;
        const media = raw
          ? normalizeMediaUrls({
              previewUrl: raw.previewUrl,
              posterUrl: raw.posterUrl,
            })
          : null;
        const adText = extra?.adText?.trim() || row.brief.adText || "";
        if (media?.previewUrl || media?.posterUrl) {
          row.previewUrl = media.previewUrl;
          row.posterUrl = media.posterUrl ?? row.posterUrl;
          row.mediaKind = media.mediaKind;
        }
        if (videoId) row.videoId = videoId;
        if (adText && !row.brief.adText) {
          row.brief = { ...row.brief, adText };
        }
        if (!media && !adText) return;
        const { data: current } = await admin
          .from("creative_publish_drafts")
          .select("publish_result, brief")
          .eq("id", row.id)
          .maybeSingle<{
            publish_result: Record<string, unknown> | null;
            brief: Record<string, unknown> | null;
          }>();
        const publish = {
          ...(current?.publish_result ?? {}),
          ...(videoId ? { video_id: videoId } : {}),
          ...(media?.posterUrl ? { poster_url: media.posterUrl } : {}),
          ...(media?.previewUrl
            ? { preview_url: media.previewUrl }
            : { preview_url: null }),
        };
        const brief = {
          ...(current?.brief ?? {}),
          ...(adText ? { adText, ad_text: adText } : {}),
        };
        await admin
          .from("creative_publish_drafts")
          .update({ publish_result: publish, brief })
          .eq("id", row.id);
      }),
    );
  }

  return drafts;
}
