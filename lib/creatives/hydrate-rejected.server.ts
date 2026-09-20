import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAdMediaPreviews,
  fetchSmartPlusCreativeMeta,
} from "@/lib/integrations/tiktok/ad-list.server";
import { fetchSmartPlusAdReviewInfo } from "@/lib/integrations/tiktok/ad-review.server";
import { normalizeMediaUrls } from "@/lib/creatives/tiktok-media-preview";
import { REJECT_REC_PREFIX } from "@/lib/creatives/reject-recommendation";
import type { CreativeDraftListItem } from "@/lib/creatives/types";

/**
 * Refresca poster/preview firmados + motivos reales de TikTok (include_reject_info).
 */
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

  if (byAdvertiser.size === 0) {
    console.warn("[hydrate-rejected] no_advertiser_ids", {
      targets: targets.length,
    });
    return drafts;
  }

  const admin = createAdminClient();

  for (const [advertiserId, rows] of byAdvertiser) {
    const adIds = rows
      .map((row) => row.externalAdId)
      .filter((id): id is string => Boolean(id));

    let meta = new Map<
      string,
      { videoId: string | null; adText: string | null }
    >();
    try {
      meta = await fetchSmartPlusCreativeMeta({
        organizationId,
        advertiserId,
        smartPlusAdIds: adIds,
      });
    } catch (error) {
      console.warn("[hydrate-rejected] smart_plus_meta", {
        advertiserId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    let reviews = new Map<
      string,
      {
        rejectReasons: string[];
        suggestions: string[];
        appealStatus: string | null;
      }
    >();
    try {
      reviews = await fetchSmartPlusAdReviewInfo({
        organizationId,
        advertiserId,
        smartPlusAdIds: adIds,
        lang: "es",
      });
    } catch (error) {
      console.warn("[hydrate-rejected] review_info", {
        advertiserId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    const videoIds = [
      ...new Set(
        rows
          .map((row) => {
            const fromMeta = row.externalAdId
              ? meta.get(row.externalAdId)?.videoId
              : null;
            return fromMeta || row.videoId;
          })
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    let previews = new Map<
      string,
      { previewUrl: string | null; posterUrl: string | null }
    >();
    try {
      previews = await fetchAdMediaPreviews({
        organizationId,
        advertiserId,
        videoIds,
        imageIds: [],
      });
    } catch (error) {
      console.warn("[hydrate-rejected] media_previews", {
        advertiserId,
        videoIds: videoIds.length,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    console.info("[hydrate-rejected] batch", {
      advertiserId,
      rows: rows.length,
      videoIds: videoIds.length,
      previews: previews.size,
      reviews: reviews.size,
    });

    await Promise.all(
      rows.map(async (row) => {
        const extra = row.externalAdId ? meta.get(row.externalAdId) : undefined;
        const review = row.externalAdId
          ? reviews.get(row.externalAdId)
          : undefined;
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
          row.previewUrl = media.previewUrl ?? row.previewUrl;
          row.posterUrl = media.posterUrl ?? row.posterUrl;
          row.mediaKind = media.mediaKind ?? row.mediaKind;
        }
        if (videoId) row.videoId = videoId;
        if (adText && !row.brief.adText) {
          row.brief = { ...row.brief, adText };
        }
        if (review?.rejectReasons?.length) {
          row.tiktokRejectReasons = review.rejectReasons;
        }
        if (review?.suggestions?.length) {
          row.tiktokSuggestions = review.suggestions;
          if (!row.rejectFixHint?.startsWith(REJECT_REC_PREFIX)) {
            row.rejectFixHint = `${REJECT_REC_PREFIX}${review.suggestions[0]!.slice(0, 160)}`;
          }
        }
        if (review?.appealStatus) {
          row.appealStatus = review.appealStatus;
        }

        const { data: current } = await admin
          .from("creative_publish_drafts")
          .select("publish_result, brief, reject_fix_hint")
          .eq("id", row.id)
          .maybeSingle<{
            publish_result: Record<string, unknown> | null;
            brief: Record<string, unknown> | null;
            reject_fix_hint: string | null;
          }>();

        const publish: Record<string, unknown> = {
          ...(current?.publish_result ?? {}),
        };
        if (videoId) publish.video_id = videoId;
        if (media?.posterUrl) publish.poster_url = media.posterUrl;
        if (media?.previewUrl) publish.preview_url = media.previewUrl;
        if (review?.appealStatus) publish.appeal_status = review.appealStatus;
        if (review?.suggestions?.length) {
          publish.tiktok_suggestions = review.suggestions;
        }

        const brief = {
          ...(current?.brief ?? {}),
          ...(adText ? { adText, ad_text: adText } : {}),
        };

        const updatePayload: Record<string, unknown> = {
          publish_result: publish,
          brief,
        };
        if (review?.rejectReasons?.length) {
          updatePayload.reject_reasons = review.rejectReasons;
        }
        if (
          review?.suggestions?.length &&
          !String(current?.reject_fix_hint ?? "").startsWith(REJECT_REC_PREFIX)
        ) {
          updatePayload.reject_fix_hint = `${REJECT_REC_PREFIX}${review.suggestions[0]!.slice(0, 160)}`;
        }

        const { error } = await admin
          .from("creative_publish_drafts")
          .update(updatePayload)
          .eq("id", row.id);
        if (error) {
          console.warn("[hydrate-rejected] save", {
            id: row.id,
            error: error.message,
          });
        }
      }),
    );
  }

  return drafts;
}
