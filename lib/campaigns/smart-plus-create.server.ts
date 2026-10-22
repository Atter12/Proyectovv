import "server-only";
import { randomInt } from "node:crypto";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import {
  buildSmartPlusPlan,
  DEFAULT_CTA_PORTFOLIO,
  validateSmartPlusPlan,
  type SmartPlusPlanError,
  type SmartPlusPlanInput,
} from "@/lib/campaigns/smart-plus-plan";

export type SmartPlusCreateResult =
  | { ok: true; campaignId: string; adgroupId: string; adId: string }
  | {
      ok: false;
      step: "validate" | "campaign" | "adgroup" | "covers" | "cta" | "ad";
      errors?: SmartPlusPlanError[];
      message?: string;
      /** Lo que sí alcanzó a crearse (queda pausado). */
      campaignId?: string;
      adgroupId?: string;
    };

/**
 * Crea campaña → grupo → anuncio Smart+ de ventas web. La campaña nace
 * pausada, así nada gasta hasta que una persona la prenda. Si un paso falla,
 * lo ya creado queda pausado y se devuelve para poder reintentar el resto.
 */
export async function createSmartPlusCampaign(input: {
  accessToken: string;
  plan: SmartPlusPlanInput;
}): Promise<SmartPlusCreateResult> {
  const errors = validateSmartPlusPlan(input.plan);
  if (errors.length > 0) return { ok: false, step: "validate", errors };

  const plan = buildSmartPlusPlan(input.plan, { requestId: newRequestId(), now: new Date() });

  let campaignId: string;
  try {
    const res = await tiktokRequest<{ campaign_id?: string }>({
      path: "/smart_plus/campaign/create/",
      method: "POST",
      accessToken: input.accessToken,
      body: plan.campaign,
    });
    if (!res.campaign_id) return { ok: false, step: "campaign", message: "TikTok no devolvió campaign_id." };
    campaignId = String(res.campaign_id);
  } catch (error) {
    return { ok: false, step: "campaign", message: errorMessage(error) };
  }

  let adgroupId: string;
  try {
    const res = await tiktokRequest<{ adgroup_id?: string }>({
      path: "/smart_plus/adgroup/create/",
      method: "POST",
      accessToken: input.accessToken,
      body: { ...plan.adgroup, campaign_id: campaignId },
    });
    if (!res.adgroup_id) return { ok: false, step: "adgroup", campaignId, message: "TikTok no devolvió adgroup_id." };
    adgroupId = String(res.adgroup_id);
  } catch (error) {
    return { ok: false, step: "adgroup", campaignId, message: errorMessage(error) };
  }

  const ad = await createSmartPlusAd({ accessToken: input.accessToken, plan: input.plan, adgroupId });
  return ad.ok ? { ok: true, campaignId, adgroupId, adId: ad.adId } : { ...ad, campaignId, adgroupId };
}

/**
 * Crea el anuncio en un grupo que ya existe (también sirve para reintentar
 * cuando falló solo el anuncio). Sube la portada de cada video y arma el
 * paquete de botones si no vienen.
 */
export async function createSmartPlusAd(input: {
  accessToken: string;
  plan: SmartPlusPlanInput;
  adgroupId: string;
}): Promise<{ ok: true; adId: string } | { ok: false; step: "covers" | "cta" | "ad"; message: string }> {
  let covers: Record<string, string>;
  try {
    covers = { ...(await uploadVideoCovers(input.accessToken, input.plan.advertiserId, input.plan.videoIds)), ...input.plan.videoCovers };
  } catch (error) {
    return { ok: false, step: "covers", message: errorMessage(error) };
  }
  let callToActionId = input.plan.callToActionId;
  if (!callToActionId) {
    try {
      const res = await tiktokRequest<{ creative_portfolio_id?: string }>({
        path: "/creative/portfolio/create/",
        method: "POST",
        accessToken: input.accessToken,
        body: {
          advertiser_id: input.plan.advertiserId,
          creative_portfolio_type: "CTA",
          portfolio_content: DEFAULT_CTA_PORTFOLIO,
        },
      });
      if (!res.creative_portfolio_id) return { ok: false, step: "cta", message: "TikTok no devolvió el paquete de botones." };
      callToActionId = String(res.creative_portfolio_id);
    } catch (error) {
      return { ok: false, step: "cta", message: errorMessage(error) };
    }
  }
  const plan = buildSmartPlusPlan(
    { ...input.plan, videoCovers: covers, callToActionId },
    { requestId: newRequestId(), now: new Date() },
  );
  try {
    const res = await tiktokRequest<{ smart_plus_ad_id?: string; ad_id?: string }>({
      path: "/smart_plus/ad/create/",
      method: "POST",
      accessToken: input.accessToken,
      body: { ...plan.ad, adgroup_id: input.adgroupId },
    });
    const adId = res.smart_plus_ad_id ?? res.ad_id;
    if (!adId) return { ok: false, step: "ad", message: "TikTok no devolvió el id del anuncio." };
    return { ok: true, adId: String(adId) };
  } catch (error) {
    return { ok: false, step: "ad", message: errorMessage(error) };
  }
}

/**
 * TikTok exige una portada (imagen) por video en Smart+. Se usa la que TikTok
 * ya generó para el video: se sube a la biblioteca de imágenes por URL.
 */
async function uploadVideoCovers(accessToken: string, advertiserId: string, videoIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(videoIds.map((v) => v.trim()).filter(Boolean))];
  if (ids.length === 0) return {};
  const info = await tiktokRequest<{ list?: Array<{ video_id?: string; video_cover_url?: string }> }>({
    path: "/file/video/ad/info/",
    accessToken,
    query: { advertiser_id: advertiserId, video_ids: ids },
  });
  const covers: Record<string, string> = {};
  for (const video of info.list ?? []) {
    if (!video.video_id || !video.video_cover_url) continue;
    const res = await tiktokRequest<{ image_id?: string }>({
      path: "/file/image/ad/upload/",
      method: "POST",
      accessToken,
      body: {
        advertiser_id: advertiserId,
        upload_type: "UPLOAD_BY_URL",
        image_url: video.video_cover_url,
        file_name: `portada-${video.video_id}-${Date.now()}`,
      },
    });
    if (res.image_id) covers[video.video_id] = String(res.image_id);
  }
  return covers;
}

/** Número largo y único: TikTok lo usa para no duplicar si se reintenta. */
function newRequestId(): string {
  return `${Date.now()}${randomInt(100, 999)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido de TikTok.";
}
