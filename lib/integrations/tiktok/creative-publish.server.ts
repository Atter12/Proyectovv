import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env/env.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import type { CreativeAgentBrief } from "@/lib/creatives/types";

type TikTokApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

function apiUrl(path: string): string {
  const base = serverEnv.tiktokApiBaseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isTikTokCreativePublishEnabled(): boolean {
  return serverEnv.tiktokCreativePublishEnabled;
}

async function tiktokJson<T>(input: {
  path: string;
  method?: "GET" | "POST";
  accessToken: string;
  body?: Record<string, unknown>;
}): Promise<TikTokApiResponse<T>> {
  const response = await fetch(apiUrl(input.path), {
    method: input.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": input.accessToken,
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store",
  });
  return (await response.json()) as TikTokApiResponse<T>;
}

export async function uploadTikTokAdVideo(input: {
  organizationId: string;
  advertiserId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ videoId: string; tiktokRequestId: string | null }> {
  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const signature = createHash("md5").update(input.buffer).digest("hex");
  const form = new FormData();
  form.append("advertiser_id", input.advertiserId);
  form.append("upload_type", "UPLOAD_BY_FILE");
  form.append("video_signature", signature);
  form.append("file_name", input.fileName.slice(0, 100));
  form.append(
    "video_file",
    new Blob([new Uint8Array(input.buffer)], {
      type: input.mimeType || "video/mp4",
    }),
    input.fileName,
  );

  const response = await fetch(apiUrl("/file/video/ad/upload/"), {
    method: "POST",
    headers: { "Access-Token": token },
    body: form,
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<{
    video_id?: string;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0) || !json.data?.video_id) {
    throw new Error(
      json.message ??
        `TikTok video upload falló (code=${json.code ?? response.status}).`,
    );
  }

  return {
    videoId: String(json.data.video_id),
    tiktokRequestId: json.request_id ?? null,
  };
}

export async function uploadTikTokAdImage(input: {
  organizationId: string;
  advertiserId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ imageId: string; tiktokRequestId: string | null }> {
  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const signature = createHash("md5").update(input.buffer).digest("hex");
  const form = new FormData();
  form.append("advertiser_id", input.advertiserId);
  form.append("upload_type", "UPLOAD_BY_FILE");
  form.append("image_signature", signature);
  form.append("file_name", input.fileName.slice(0, 100));
  form.append(
    "image_file",
    new Blob([new Uint8Array(input.buffer)], {
      type: input.mimeType || "image/jpeg",
    }),
    input.fileName,
  );

  const response = await fetch(apiUrl("/file/image/ad/upload/"), {
    method: "POST",
    headers: { "Access-Token": token },
    body: form,
    cache: "no-store",
  });
  const json = (await response.json()) as TikTokApiResponse<{
    image_id?: string;
  }>;

  if (!response.ok || (json.code !== undefined && json.code !== 0) || !json.data?.image_id) {
    throw new Error(
      json.message ??
        `TikTok image upload falló (code=${json.code ?? response.status}).`,
    );
  }

  return {
    imageId: String(json.data.image_id),
    tiktokRequestId: json.request_id ?? null,
  };
}

/**
 * Crea Campaign → Ad Group → Ad en estado PAUSED (humano prende en Ads Manager).
 * Requiere TIKTOK_CREATIVE_PUBLISH_ENABLED=true y scopes de Ads Management.
 */
export async function publishCreativeDraftToTikTok(input: {
  organizationId: string;
  advertiserId: string;
  brief: CreativeAgentBrief;
  assetType: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{
  campaignId: string;
  adgroupId: string;
  adId: string;
  videoId: string | null;
  imageId: string | null;
  tiktokRequestIds: string[];
}> {
  if (!isTikTokCreativePublishEnabled()) {
    throw new Error(
      "Publicación TikTok desactivada (TIKTOK_CREATIVE_PUBLISH_ENABLED).",
    );
  }

  const { token } = await resolveTikTokFinanceAccessToken(input.organizationId);
  const requestIds: string[] = [];
  let videoId: string | null = null;
  let imageId: string | null = null;

  if (input.assetType === "video" || input.mimeType.startsWith("video/")) {
    const uploaded = await uploadTikTokAdVideo({
      organizationId: input.organizationId,
      advertiserId: input.advertiserId,
      fileName: input.fileName,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    videoId = uploaded.videoId;
    if (uploaded.tiktokRequestId) requestIds.push(uploaded.tiktokRequestId);
  } else if (input.assetType === "image" || input.mimeType.startsWith("image/")) {
    const uploaded = await uploadTikTokAdImage({
      organizationId: input.organizationId,
      advertiserId: input.advertiserId,
      fileName: input.fileName,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    imageId = uploaded.imageId;
    if (uploaded.tiktokRequestId) requestIds.push(uploaded.tiktokRequestId);
  } else {
    throw new Error("Solo se pueden publicar imágenes o videos en TikTok.");
  }

  const objectiveMap: Record<string, string> = {
    TRAFFIC: "TRAFFIC",
    CONVERSIONS: "CONVERSIONS",
    REACH: "REACH",
    VIDEO_VIEWS: "VIDEO_VIEWS",
  };
  const objective =
    objectiveMap[input.brief.objective.toUpperCase()] ?? "TRAFFIC";

  const campaignRes = await tiktokJson<{ campaign_id?: string }>({
    path: "/campaign/create/",
    accessToken: token,
    body: {
      advertiser_id: input.advertiserId,
      campaign_name: input.brief.campaignName.slice(0, 100),
      objective_type: objective,
      budget_mode: "BUDGET_MODE_INFINITE",
      operation_status: "DISABLE",
    },
  });
  if (campaignRes.code !== 0 || !campaignRes.data?.campaign_id) {
    throw new Error(campaignRes.message ?? "No se pudo crear la campaña.");
  }
  if (campaignRes.request_id) requestIds.push(campaignRes.request_id);
  const campaignId = String(campaignRes.data.campaign_id);

  const budget = Math.max(20, Math.round(input.brief.suggestedDailyBudgetUsd));
  const adgroupRes = await tiktokJson<{ adgroup_id?: string }>({
    path: "/adgroup/create/",
    accessToken: token,
    body: {
      advertiser_id: input.advertiserId,
      campaign_id: campaignId,
      adgroup_name: input.brief.adgroupName.slice(0, 100),
      promotion_type: "WEBSITE",
      placement_type: "PLACEMENT_TYPE_AUTOMATIC",
      budget_mode: "BUDGET_MODE_DAY",
      budget,
      schedule_type: "SCHEDULE_FROM_NOW",
      billing_event: "CPC",
      bid_type: "BID_TYPE_NO_BID",
      operation_status: "DISABLE",
      pacing: "PACING_MODE_SMOOTH",
    },
  });
  if (adgroupRes.code !== 0 || !adgroupRes.data?.adgroup_id) {
    throw new Error(adgroupRes.message ?? "No se pudo crear el ad group.");
  }
  if (adgroupRes.request_id) requestIds.push(adgroupRes.request_id);
  const adgroupId = String(adgroupRes.data.adgroup_id);

  const creatives: Record<string, unknown>[] = [
    {
      ad_name: input.brief.adName.slice(0, 100),
      ad_format: videoId ? "SINGLE_VIDEO" : "SINGLE_IMAGE",
      ad_text: input.brief.adText.slice(0, 100),
      call_to_action: input.brief.callToAction || "SHOP_NOW",
      landing_page_url:
        input.brief.landingPageUrl || "https://www.tiktok.com",
      ...(videoId ? { video_id: videoId } : {}),
      ...(imageId ? { image_ids: [imageId] } : {}),
    },
  ];

  const adRes = await tiktokJson<{ ad_ids?: string[] }>({
    path: "/ad/create/",
    accessToken: token,
    body: {
      advertiser_id: input.advertiserId,
      adgroup_id: adgroupId,
      creatives,
    },
  });
  if (adRes.code !== 0 || !adRes.data?.ad_ids?.[0]) {
    throw new Error(adRes.message ?? "No se pudo crear el anuncio.");
  }
  if (adRes.request_id) requestIds.push(adRes.request_id);

  return {
    campaignId,
    adgroupId,
    adId: String(adRes.data.ad_ids[0]),
    videoId,
    imageId,
    tiktokRequestIds: requestIds,
  };
}
