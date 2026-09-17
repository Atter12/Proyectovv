import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAdReviewInfo,
  fetchAdSecondaryStatuses,
  type TikTokAdReviewStatus,
} from "@/lib/integrations/tiktok/ad-review.server";

type PublishedDraftRow = {
  id: string;
  organization_id: string;
  external_advertiser_id: string | null;
  ad_account_id: string | null;
  publish_result: Record<string, unknown> | null;
  review_status: string | null;
};

function readAdId(publishResult: Record<string, unknown> | null): string | null {
  if (!publishResult) return null;
  const adId = publishResult.ad_id ?? publishResult.adId;
  const text = String(adId ?? "").trim();
  return text || null;
}

/**
 * Consulta review TikTok de drafts publicados y guarda motivos de rechazo.
 * No toca el status Holistic del draft (sigue "published").
 */
export async function syncPublishedCreativeAdReviews(input?: {
  organizationId?: string;
  limit?: number;
}): Promise<{
  scanned: number;
  updated: number;
  rejected: number;
  approved: number;
  pending: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const limit = Math.max(1, Math.min(input?.limit ?? 40, 100));
  const errors: string[] = [];

  let query = admin
    .from("creative_publish_drafts")
    .select(
      "id, organization_id, external_advertiser_id, ad_account_id, publish_result, review_status",
    )
    .eq("status", "published")
    .or(
      "review_status.is.null,review_status.eq.pending,review_status.eq.unknown",
    )
    .order("published_at", { ascending: false })
    .limit(limit);

  if (input?.organizationId) {
    query = query.eq("organization_id", input.organizationId);
  }

  const { data: rows, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const drafts = (rows ?? []) as PublishedDraftRow[];
  if (drafts.length === 0) {
    return {
      scanned: 0,
      updated: 0,
      rejected: 0,
      approved: 0,
      pending: 0,
      errors,
    };
  }

  // Resolver advertiser_id faltante vía ad_accounts.
  const accountIds = [
    ...new Set(
      drafts
        .filter((d) => !d.external_advertiser_id?.trim() && d.ad_account_id)
        .map((d) => d.ad_account_id as string),
    ),
  ];
  const advertiserByAccount = new Map<string, string>();
  if (accountIds.length > 0) {
    const { data: accounts } = await admin
      .from("ad_accounts")
      .select("id, external_account_id")
      .in("id", accountIds);
    for (const account of accounts ?? []) {
      const ext = String(
        (account as { external_account_id?: string }).external_account_id ?? "",
      ).trim();
      if (ext) {
        advertiserByAccount.set(
          (account as { id: string }).id,
          ext,
        );
      }
    }
  }

  type WorkItem = {
    draftId: string;
    organizationId: string;
    advertiserId: string;
    adId: string;
  };

  const work: WorkItem[] = [];
  for (const draft of drafts) {
    const adId = readAdId(draft.publish_result);
    const advertiserId =
      draft.external_advertiser_id?.trim() ||
      (draft.ad_account_id
        ? advertiserByAccount.get(draft.ad_account_id) ?? ""
        : "");
    if (!adId || !advertiserId) {
      errors.push(`draft ${draft.id}: falta ad_id o advertiser_id`);
      continue;
    }
    work.push({
      draftId: draft.id,
      organizationId: draft.organization_id,
      advertiserId,
      adId,
    });
  }

  // Agrupar por org+advertiser para batch.
  const groups = new Map<string, WorkItem[]>();
  for (const item of work) {
    const key = `${item.organizationId}:${item.advertiserId}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  let updated = 0;
  let rejected = 0;
  let approved = 0;
  let pending = 0;
  const now = new Date().toISOString();

  for (const [, items] of groups) {
    const organizationId = items[0]!.organizationId;
    const advertiserId = items[0]!.advertiserId;
    const adIds = [...new Set(items.map((item) => item.adId))];

    let reviews: Awaited<ReturnType<typeof fetchAdReviewInfo>>;
    try {
      reviews = await fetchAdReviewInfo({
        organizationId,
        advertiserId,
        adIds,
        lang: "es",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "review_info failed";
      errors.push(`${advertiserId}: ${message}`);
      continue;
    }

    let secondary = new Map<string, string | null>();
    try {
      secondary = await fetchAdSecondaryStatuses({
        organizationId,
        advertiserId,
        adIds,
      });
    } catch {
      // best-effort
    }

    for (const item of items) {
      const snap = reviews.get(item.adId);
      const secondaryStatus = secondary.get(item.adId) ?? null;
      const reviewStatus: TikTokAdReviewStatus = snap?.reviewStatus ?? "unknown";
      const rejectReasons = snap?.rejectReasons ?? [];

      // Si secondary_status sugiere problema de review y aún no hay motivos, marcar pending/rejected.
      let finalStatus = reviewStatus;
      if (
        finalStatus === "unknown" &&
        secondaryStatus &&
        /REJECT|DENY|AUDIT|REVIEW_FAIL|NOT_DELIVER|PARTIAL/i.test(secondaryStatus)
      ) {
        finalStatus = /REJECT|DENY|FAIL/i.test(secondaryStatus)
          ? "rejected"
          : "pending";
      }

      const { error: updError } = await admin
        .from("creative_publish_drafts")
        .update({
          review_status: finalStatus,
          reject_reasons: rejectReasons,
          secondary_status: secondaryStatus,
          review_checked_at: now,
          updated_at: now,
        })
        .eq("id", item.draftId)
        .eq("organization_id", organizationId);

      if (updError) {
        errors.push(`draft ${item.draftId}: ${updError.message}`);
        continue;
      }

      updated += 1;
      if (finalStatus === "rejected") rejected += 1;
      else if (finalStatus === "approved") approved += 1;
      else pending += 1;
    }
  }

  console.info("[creatives] ad_review_sync", {
    scanned: drafts.length,
    updated,
    rejected,
    approved,
    pending,
    errorCount: errors.length,
  });

  return {
    scanned: drafts.length,
    updated,
    rejected,
    approved,
    pending,
    errors: errors.slice(0, 20),
  };
}
