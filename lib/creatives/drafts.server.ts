import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isTikTokCreativePublishEnabled,
  publishCreativeDraftToTikTok,
} from "@/lib/integrations/tiktok/creative-publish.server";
import type { CreativeAgentBrief } from "@/lib/creatives/types";
import {
  classifyTikTokRejectReasons,
  countRecentSameKindRejects,
  REJECT_REPEAT_LIMIT,
  repeatRejectBlockMessage,
} from "@/lib/creatives/tiktok-reject-action";

export async function rejectCreativeDraft(input: {
  organizationId: string;
  draftId: string;
  userId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("creative_publish_drafts")
    .update({
      status: "rejected",
      reviewed_by: input.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.draftId)
    .eq("organization_id", input.organizationId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Borrador no encontrado o ya revisado.");
}

async function assertNotRepeatReject(input: {
  admin: ReturnType<typeof createAdminClient>;
  organizationId: string;
  advertiserId: string;
}): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await input.admin
    .from("creative_publish_drafts")
    .select("reject_reasons, review_checked_at, updated_at, published_at")
    .eq("organization_id", input.organizationId)
    .eq("external_advertiser_id", input.advertiserId)
    .eq("review_status", "rejected")
    .gte("updated_at", since)
    .limit(40);

  if (error) {
    console.warn("[creatives] repeat_reject_check", error.message);
    return;
  }

  const recent = (data ?? []).map((row) => {
    const reasons = Array.isArray(row.reject_reasons)
      ? row.reject_reasons.map((item) => String(item ?? ""))
      : [];
    const at =
      (typeof row.review_checked_at === "string" && row.review_checked_at) ||
      (typeof row.published_at === "string" && row.published_at) ||
      (typeof row.updated_at === "string" && row.updated_at) ||
      new Date().toISOString();
    return { kind: classifyTikTokRejectReasons(reasons), at };
  });

  const kinds = ["policy", "claims", "media_invalid", "generic"] as const;
  for (const kind of kinds) {
    const count = countRecentSameKindRejects({ kind, recent });
    if (count >= REJECT_REPEAT_LIMIT) {
      throw new Error(repeatRejectBlockMessage(kind, count));
    }
  }
}

async function runTikTokPublish(input: {
  organizationId: string;
  draftId: string;
  userId: string;
  draft: {
    id: string;
    brief: CreativeAgentBrief;
    creative_asset_id: string | null;
    ad_account_id: string | null;
    external_advertiser_id: string | null;
    parent_draft_id?: string | null;
  };
}): Promise<{
  status: string;
  published: boolean;
  publishResult: Record<string, unknown> | null;
}> {
  if (!isTikTokCreativePublishEnabled()) {
    throw new Error(
      "Publicación TikTok desactivada. Pide a Holistic activar TIKTOK_CREATIVE_PUBLISH_ENABLED.",
    );
  }

  const admin = createAdminClient();

  await admin
    .from("creative_publish_drafts")
    .update({
      status: "publishing",
      reviewed_by: input.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", input.draft.id);

  try {
    let advertiserId = input.draft.external_advertiser_id?.trim() || "";
    if (!advertiserId && input.draft.ad_account_id) {
      const { data: acc } = await admin
        .from("ad_accounts")
        .select("external_account_id")
        .eq("id", input.draft.ad_account_id)
        .maybeSingle<{ external_account_id: string | null }>();
      advertiserId = acc?.external_account_id?.trim() || "";
    }
    if (!advertiserId) {
      throw new Error(
        "Falta advertiser_id de TikTok. Vincula una cuenta Aprobada al subir el creativo.",
      );
    }

    if (!input.draft.parent_draft_id) {
      await assertNotRepeatReject({
        admin,
        organizationId: input.organizationId,
        advertiserId,
      });
    }
    if (!input.draft.creative_asset_id) {
      throw new Error("El borrador no tiene creativo asociado.");
    }

    const { data: asset } = await admin
      .from("creative_assets")
      .select(
        "id, name, asset_type, mime_type, storage_bucket, storage_path",
      )
      .eq("id", input.draft.creative_asset_id)
      .maybeSingle<{
        id: string;
        name: string;
        asset_type: string;
        mime_type: string | null;
        storage_bucket: string | null;
        storage_path: string | null;
      }>();

    if (!asset?.storage_bucket || !asset.storage_path) {
      throw new Error("Creativo sin archivo en storage.");
    }

    const { data: file, error: dlError } = await admin.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);
    if (dlError || !file) {
      throw new Error(dlError?.message ?? "No se pudo descargar el creativo.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const published = await publishCreativeDraftToTikTok({
      organizationId: input.organizationId,
      advertiserId,
      brief: input.draft.brief,
      assetType: asset.asset_type,
      fileName: asset.name,
      buffer,
      mimeType: asset.mime_type || "application/octet-stream",
    });

    const publishResult = {
      campaign_id: published.campaignId,
      adgroup_id: published.adgroupId,
      ad_id: published.adId,
      video_id: published.videoId,
      image_id: published.imageId,
      tiktok_request_ids: published.tiktokRequestIds,
      created_paused: true,
    };

    await admin
      .from("creative_publish_drafts")
      .update({
        status: "published",
        publish_result: publishResult,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
        review_status: "pending",
        reject_reasons: [],
        secondary_status: null,
        review_checked_at: null,
        external_ad_id: published.adId,
        discover_source: "holistic",
      })
      .eq("id", input.draft.id);

    return { status: "published", published: true, publishResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    await admin
      .from("creative_publish_drafts")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.draft.id);
    throw new Error(message);
  }
}

export async function approveCreativeDraft(input: {
  organizationId: string;
  draftId: string;
  userId: string;
  publish?: boolean;
}): Promise<{
  status: string;
  published: boolean;
  publishResult: Record<string, unknown> | null;
}> {
  const admin = createAdminClient();
  const { data: draft, error } = await admin
    .from("creative_publish_drafts")
    .select(
      "id, status, brief, creative_asset_id, ad_account_id, external_advertiser_id, parent_draft_id",
    )
    .eq("id", input.draftId)
    .eq("organization_id", input.organizationId)
    .maybeSingle<{
      id: string;
      status: string;
      brief: CreativeAgentBrief;
      creative_asset_id: string | null;
      ad_account_id: string | null;
      external_advertiser_id: string | null;
      parent_draft_id: string | null;
    }>();

  if (error) throw new Error(error.message);
  if (!draft) throw new Error("Borrador no encontrado.");
  if (draft.status !== "draft" && draft.status !== "failed") {
    throw new Error("Este borrador ya fue revisado.");
  }

  const wantPublish =
    Boolean(input.publish) && isTikTokCreativePublishEnabled();

  if (!wantPublish) {
    if (Boolean(input.publish) && !isTikTokCreativePublishEnabled()) {
      throw new Error(
        "Publicación TikTok desactivada. Pide a Holistic activar TIKTOK_CREATIVE_PUBLISH_ENABLED.",
      );
    }
    const { error: updError } = await admin
      .from("creative_publish_drafts")
      .update({
        status: "approved",
        reviewed_by: input.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", draft.id);
    if (updError) throw new Error(updError.message);
    return { status: "approved", published: false, publishResult: null };
  }

  return runTikTokPublish({
    organizationId: input.organizationId,
    draftId: input.draftId,
    userId: input.userId,
    draft,
  });
}

/** Enviar a TikTok un brief ya aprobado (o reintentar failed). */
export async function publishApprovedCreativeDraft(input: {
  organizationId: string;
  draftId: string;
  userId: string;
}): Promise<{
  status: string;
  published: boolean;
  publishResult: Record<string, unknown> | null;
}> {
  const admin = createAdminClient();
  const { data: draft, error } = await admin
    .from("creative_publish_drafts")
    .select(
      "id, status, brief, creative_asset_id, ad_account_id, external_advertiser_id, parent_draft_id",
    )
    .eq("id", input.draftId)
    .eq("organization_id", input.organizationId)
    .maybeSingle<{
      id: string;
      status: string;
      brief: CreativeAgentBrief;
      creative_asset_id: string | null;
      ad_account_id: string | null;
      external_advertiser_id: string | null;
      parent_draft_id: string | null;
    }>();

  if (error) throw new Error(error.message);
  if (!draft) throw new Error("Borrador no encontrado.");
  if (
    draft.status !== "approved" &&
    draft.status !== "failed" &&
    draft.status !== "draft"
  ) {
    throw new Error("Este borrador no se puede enviar a TikTok ahora.");
  }

  return runTikTokPublish({
    organizationId: input.organizationId,
    draftId: input.draftId,
    userId: input.userId,
    draft,
  });
}
