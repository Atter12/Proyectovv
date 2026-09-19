import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAdvertiserAds, fetchAdMediaPreviews, fetchSmartPlusVideoIds } from "@/lib/integrations/tiktok/ad-list.server";
import {
  fetchAdReviewInfo,
  fetchSmartPlusAdReviewInfo,
} from "@/lib/integrations/tiktok/ad-review.server";
import type { CreativeAgentBrief } from "@/lib/creatives/types";
import { looksLikeRejectedAdStatus } from "@/lib/creatives/tiktok-reject-action";

const REVIEW_PROBLEM_FALLBACK =
  "TikTok no publicó este anuncio (problema de revisión). Cambia el video antes de subir otro.";

/** Evita re-pegarle a TikTok en cada navegación/refresh (por org+advertisers). */
const DISCOVER_TTL_MS = 3 * 60 * 1000;
const discoverTtlCache = new Map<string, number>();

type AccountRow = {
  id: string;
  external_account_id: string | null;
  name: string | null;
};

function stubBrief(input: {
  adName: string;
  accountName: string | null;
}): CreativeAgentBrief {
  const label = input.adName.slice(0, 80) || "Anuncio TikTok";
  return {
    objective: "TRAFFIC",
    audience: "",
    hookCopy: "",
    adText: "",
    callToAction: "LEARN_MORE",
    campaignName: label,
    adgroupName: label,
    adName: label,
    suggestedDailyBudgetUsd: 20,
    landingPageUrl: null,
    notes: [
      "Importado desde TikTok Ads Manager (Smart+ / Ads Manager).",
      input.accountName ? `Cuenta: ${input.accountName}` : "",
    ].filter(Boolean),
  };
}

async function upsertRejectedDraft(input: {
  admin: ReturnType<typeof createAdminClient>;
  organizationId: string;
  advertiserId: string;
  adAccountId: string | null;
  accountName: string | null;
  externalAdId: string;
  adName: string;
  campaignId: string | null;
  adgroupId: string | null;
  videoId: string | null;
  imageIds: string[];
  smartPlusAdId: string | null;
  secondaryStatus: string | null;
  rejectReasons: string[];
  posterUrl?: string | null;
  previewUrl?: string | null;
}): Promise<boolean> {
  const now = new Date().toISOString();
  const publishResult = {
    ad_id: input.externalAdId,
    campaign_id: input.campaignId,
    adgroup_id: input.adgroupId,
    video_id: input.videoId,
    image_ids: input.imageIds,
    smart_plus_ad_id: input.smartPlusAdId,
    source: "tiktok_ads_manager",
    discovered_at: now,
    poster_url: input.posterUrl ?? null,
    preview_url: input.previewUrl ?? null,
  };
  const brief = stubBrief({
    adName: input.adName,
    accountName: input.accountName,
  });

  const { data: existing } = await input.admin
    .from("creative_publish_drafts")
    .select("id, discover_source")
    .eq("organization_id", input.organizationId)
    .eq("external_ad_id", input.externalAdId)
    .maybeSingle<{ id: string; discover_source: string | null }>();

  if (existing?.id) {
    const { error } = await input.admin
      .from("creative_publish_drafts")
      .update({
        status: "published",
        review_status: "rejected",
        reject_reasons: input.rejectReasons,
        secondary_status: input.secondaryStatus,
        review_checked_at: now,
        reviewed_at: now,
        updated_at: now,
        ad_account_id: input.adAccountId,
        external_advertiser_id: input.advertiserId,
        publish_result: publishResult,
        ...(existing.discover_source === "tiktok_ads_manager" ||
        !existing.discover_source
          ? { brief, discover_source: "tiktok_ads_manager" }
          : {}),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return true;
  }

  const { error } = await input.admin.from("creative_publish_drafts").insert({
    organization_id: input.organizationId,
    creative_asset_id: null,
    analysis_job_id: null,
    ad_account_id: input.adAccountId,
    external_advertiser_id: input.advertiserId,
    external_ad_id: input.externalAdId,
    discover_source: "tiktok_ads_manager",
    status: "published",
    brief,
    publish_result: publishResult,
    review_status: "rejected",
    reject_reasons: input.rejectReasons,
    secondary_status: input.secondaryStatus,
    review_checked_at: now,
    reviewed_at: now,
    published_at: now,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      await input.admin
        .from("creative_publish_drafts")
        .update({
          review_status: "rejected",
          reject_reasons: input.rejectReasons,
          secondary_status: input.secondaryStatus,
          review_checked_at: now,
          updated_at: now,
          publish_result: publishResult,
        })
        .eq("organization_id", input.organizationId)
        .eq("external_ad_id", input.externalAdId);
      return true;
    }
    throw new Error(error.message);
  }
  return true;
}

/**
 * Descubre ads rechazados en Ads Manager (incluye Upgraded Smart+).
 */
export async function discoverRejectedAdsForAdvertisers(input: {
  organizationId: string;
  advertiserAccountMap: Map<
    string,
    { adAccountId: string | null; accountName: string | null }
  >;
  maxAdsPerAdvertiser?: number;
}): Promise<{
  advertisers: number;
  listed: number;
  upserted: number;
  rejected: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const errors: string[] = [];
  let listed = 0;
  let upserted = 0;
  let rejected = 0;
  const advertiserIds = [...input.advertiserAccountMap.keys()];

  for (const advertiserId of advertiserIds) {
    const meta = input.advertiserAccountMap.get(advertiserId);
    const pending: Array<
      Omit<Parameters<typeof upsertRejectedDraft>[0], "admin" | "organizationId" | "advertiserId" | "adAccountId" | "accountName">
    > = [];
    try {
      const allAds = await listAdvertiserAds({
        organizationId: input.organizationId,
        advertiserId,
        maxPages: 8,
        pageSize: 50,
      });
      listed += allAds.length;
      if (allAds.length === 0) continue;

      // Preferir smart_plus_ad_id único (container Smart+).
      const smartMap = new Map<
        string,
        (typeof allAds)[number]
      >();
      const classicAds: typeof allAds = [];
      for (const ad of allAds) {
        if (ad.smartPlusAdId) {
          if (!smartMap.has(ad.smartPlusAdId)) smartMap.set(ad.smartPlusAdId, ad);
        } else {
          classicAds.push(ad);
        }
      }

      const smartIds = [...smartMap.keys()].slice(
        0,
        input.maxAdsPerAdvertiser ?? 80,
      );

      if (smartIds.length > 0) {
        try {
          const reviews = await fetchSmartPlusAdReviewInfo({
            organizationId: input.organizationId,
            advertiserId,
            smartPlusAdIds: smartIds,
            lang: "es",
          });

          for (const [spId, snap] of reviews) {
            const ad = smartMap.get(spId);
            if (!ad) continue;
            const secondary = snap.secondaryStatus ?? ad.secondaryStatus;
            const rejectedByApi = snap.reviewStatus === "rejected";
            const rejectedByStatus = looksLikeRejectedAdStatus(secondary);
            if (!rejectedByApi && !rejectedByStatus) continue;
            rejected += 1;
            pending.push({
              // Clave estable: smart_plus_ad_id (un ad container, muchos creatives).
              externalAdId: spId,
              adName: ad.adName,
              campaignId: ad.campaignId,
              adgroupId: ad.adgroupId,
              videoId: ad.videoId,
              imageIds: ad.imageIds,
              smartPlusAdId: spId,
              secondaryStatus: secondary,
              rejectReasons:
                snap.rejectReasons.length > 0
                  ? snap.rejectReasons
                  : [REVIEW_PROBLEM_FALLBACK],
            });
          }
          for (const [spId, ad] of smartMap) {
            if (reviews.has(spId)) continue;
            if (!looksLikeRejectedAdStatus(ad.secondaryStatus)) continue;
            rejected += 1;
            pending.push({
              externalAdId: spId,
              adName: ad.adName,
              campaignId: ad.campaignId,
              adgroupId: ad.adgroupId,
              videoId: ad.videoId,
              imageIds: ad.imageIds,
              smartPlusAdId: spId,
              secondaryStatus: ad.secondaryStatus,
              rejectReasons: [REVIEW_PROBLEM_FALLBACK],
            });
          }
        } catch (error) {
          errors.push(
            `${advertiserId}: smart_plus ${
              error instanceof Error ? error.message : "error"
            }`,
          );
        }
      }

      // Ads clásicos (sin Smart+).
      const classicIds = classicAds
        .slice(0, input.maxAdsPerAdvertiser ?? 40)
        .map((a) => a.adId);
      if (classicIds.length > 0) {
        try {
          const reviews = await fetchAdReviewInfo({
            organizationId: input.organizationId,
            advertiserId,
            adIds: classicIds,
            lang: "es",
          });
          for (const ad of classicAds) {
            const snap = reviews.get(ad.adId);
            const secondary = snap?.secondaryStatus ?? ad.secondaryStatus;
            const rejectedByApi = snap?.reviewStatus === "rejected";
            const rejectedByStatus = looksLikeRejectedAdStatus(secondary);
            if (!rejectedByApi && !rejectedByStatus) continue;
            rejected += 1;
            pending.push({
              externalAdId: ad.adId,
              adName: ad.adName,
              campaignId: ad.campaignId,
              adgroupId: ad.adgroupId,
              videoId: ad.videoId,
              imageIds: ad.imageIds,
              smartPlusAdId: null,
              secondaryStatus: secondary,
              rejectReasons:
                snap && snap.rejectReasons.length > 0
                  ? snap.rejectReasons
                  : [REVIEW_PROBLEM_FALLBACK],
            });
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "error";
          // Esperado si la cuenta es 100% Smart+.
          if (!/Smart Plus/i.test(msg)) {
            errors.push(`${advertiserId}: classic ${msg}`);
          }
        }
      }

      if (pending.length > 0) {
        const smartVideoIds = await fetchSmartPlusVideoIds({
          organizationId: input.organizationId,
          advertiserId,
          smartPlusAdIds: pending
            .map((item) => item.smartPlusAdId)
            .filter((id): id is string => Boolean(id)),
        }).catch(() => new Map<string, string>());
        const resolved = pending.map((item) => ({
          ...item,
          videoId:
            item.videoId ||
            (item.smartPlusAdId
              ? (smartVideoIds.get(item.smartPlusAdId) ?? null)
              : null),
        }));
        let previews = new Map<
          string,
          { posterUrl: string | null; previewUrl: string | null }
        >();
        try {
          previews = await fetchAdMediaPreviews({
            organizationId: input.organizationId,
            advertiserId,
            videoIds: resolved
              .map((item) => item.videoId)
              .filter((id): id is string => Boolean(id)),
            imageIds: resolved.flatMap((item) => item.imageIds),
          });
        } catch (error) {
          errors.push(
            `${advertiserId}: preview ${
              error instanceof Error ? error.message : "error"
            }`,
          );
        }
        for (const item of resolved) {
          const fromVideo = item.videoId
            ? previews.get(item.videoId)
            : undefined;
          const fromImage = item.imageIds
            .map((id) => previews.get(id))
            .find(Boolean);
          const media = fromVideo ?? fromImage ?? null;
          const ok = await upsertRejectedDraft({
            admin,
            organizationId: input.organizationId,
            advertiserId,
            adAccountId: meta?.adAccountId ?? null,
            accountName: meta?.accountName ?? null,
            ...item,
            posterUrl: media?.posterUrl ?? null,
            previewUrl: media?.previewUrl ?? null,
          });
          if (ok) upserted += 1;
        }
      }
    } catch (error) {
      errors.push(
        `${advertiserId}: ${error instanceof Error ? error.message : "error"}`,
      );
    }
  }

  return {
    advertisers: advertiserIds.length,
    listed,
    upserted,
    rejected,
    errors,
  };
}

export async function discoverRejectedAdsForOrganization(input: {
  organizationId: string;
  advertiserIds: string[];
  adAccountIds?: string[];
}): Promise<
  Awaited<ReturnType<typeof discoverRejectedAdsForAdvertisers>> & {
    skippedByTtl?: boolean;
  }
> {
  const admin = createAdminClient();
  const advertiserIds = [
    ...new Set(input.advertiserIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (advertiserIds.length === 0) {
    return {
      advertisers: 0,
      listed: 0,
      upserted: 0,
      rejected: 0,
      errors: [],
    };
  }

  const ttlKey = [
    input.organizationId,
    ...advertiserIds.slice().sort(),
  ].join("|");
  const cachedAt = discoverTtlCache.get(ttlKey);
  if (
    cachedAt != null &&
    Date.now() - cachedAt < DISCOVER_TTL_MS
  ) {
    return {
      advertisers: advertiserIds.length,
      listed: 0,
      upserted: 0,
      rejected: 0,
      errors: [],
      skippedByTtl: true,
    };
  }

  let accountsQuery = admin
    .from("ad_accounts")
    .select("id, external_account_id, name")
    .eq("organization_id", input.organizationId)
    .eq("platform", "tiktok")
    .in("external_account_id", advertiserIds);

  if (input.adAccountIds?.length) {
    accountsQuery = accountsQuery.in("id", input.adAccountIds);
  }

  const { data: accounts } = await accountsQuery;
  const map = new Map<
    string,
    { adAccountId: string | null; accountName: string | null }
  >();

  for (const id of advertiserIds) {
    map.set(id, { adAccountId: null, accountName: null });
  }
  for (const row of (accounts ?? []) as AccountRow[]) {
    const adv = row.external_account_id?.trim();
    if (!adv) continue;
    map.set(adv, {
      adAccountId: row.id,
      accountName: row.name,
    });
  }

  const result = await discoverRejectedAdsForAdvertisers({
    organizationId: input.organizationId,
    advertiserAccountMap: map,
  });
  discoverTtlCache.set(ttlKey, Date.now());
  return result;
}
