import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import { listAccountVideos, type LaunchOptions } from "@/lib/campaigns/launch-options.server";
import { uploadVideoCovers } from "@/lib/campaigns/smart-plus-create.server";
import { buildAddVideosUpdate, MAX_AD_VIDEOS, type AddVideosError } from "@/lib/campaigns/smart-plus-plan";

type LaunchRow = { id: string; advertiser_id: string; campaign_id: string; ad_id: string | null; video_ids: string[] | null };

const ADD_ERRORS: Record<AddVideosError, string> = {
  noVideos: "Elige al menos un video.",
  nothingNew: "Esos videos ya están en la campaña.",
  tooManyVideos: `El anuncio no acepta más de ${MAX_AD_VIDEOS} videos.`,
  noCover: "TikTok no dio la portada de un video: prueba con otro o vuelve a subirlo.",
  noIdentity: "No se encontró el perfil que publica en la campaña.",
};

/** Campaña lanzada, solo si es del cliente indicado. */
async function loadLaunch(launchId: string, hecomClienteId: string): Promise<LaunchRow | null> {
  const { data } = await createAdminClient()
    .from("campaign_launches")
    .select("id, advertiser_id, campaign_id, ad_id, video_ids, hecom_cliente_id")
    .eq("id", launchId)
    .maybeSingle<LaunchRow & { hecom_cliente_id: string | null }>();
  return data && data.hecom_cliente_id === hecomClienteId ? data : null;
}

/** Anuncio Smart+ de la campaña tal como está hoy en TikTok. */
async function loadLiveAd(token: string, launch: LaunchRow): Promise<Record<string, unknown> | null> {
  const res = await tiktokRequest<{ list?: Record<string, unknown>[] }>({
    path: "/smart_plus/ad/get/",
    accessToken: token,
    query: { advertiser_id: launch.advertiser_id, filtering: { campaign_ids: [launch.campaign_id] }, page_size: "20" },
  });
  const ads = res.list ?? [];
  return ads.find((a) => String(a.smart_plus_ad_id) === launch.ad_id) ?? ads[0] ?? null;
}

/** Videos de la biblioteca de la cuenta que todavía no están en la campaña. */
export async function listVideosForLaunch(
  launchId: string,
  hecomClienteId: string,
): Promise<{ ok: true; videos: LaunchOptions["videos"] } | { ok: false; message: string }> {
  const launch = await loadLaunch(launchId, hecomClienteId);
  if (!launch) return { ok: false, message: "Campaña no encontrada." };
  const { token } = await resolveTikTokFinanceAccessToken(undefined);
  const [videos, ad] = await Promise.all([listAccountVideos(token, launch.advertiser_id), loadLiveAd(token, launch)]);
  const inAd = new Set(
    ((ad?.creative_list as Record<string, unknown>[] | undefined) ?? []).map((c) =>
      String(((c.creative_info as Record<string, unknown> | undefined)?.video_info as Record<string, unknown> | undefined)?.video_id ?? ""),
    ),
  );
  return { ok: true, videos: videos.filter((v) => !inAd.has(v.videoId)) };
}

/**
 * Suma videos de la biblioteca de la cuenta al anuncio de una campaña
 * lanzada. Las portadas se suben primero (TikTok las exige); /file/video/ad/info/
 * solo devuelve videos de esta cuenta, así que un id ajeno queda sin portada
 * y se rechaza.
 */
export async function addVideosToLaunch(input: {
  launchId: string;
  hecomClienteId: string;
  videoIds: string[];
}): Promise<{ ok: true; added: string[] } | { ok: false; message: string }> {
  const launch = await loadLaunch(input.launchId, input.hecomClienteId);
  if (!launch) return { ok: false, message: "Campaña no encontrada." };
  const videoIds = [...new Set(input.videoIds.map((v) => v.trim()).filter(Boolean))].slice(0, 10);
  if (videoIds.length === 0) return { ok: false, message: ADD_ERRORS.noVideos };

  const { token } = await resolveTikTokFinanceAccessToken(undefined);
  const ad = await loadLiveAd(token, launch);
  if (!ad) return { ok: false, message: "No se encontró el anuncio de la campaña en TikTok." };
  const covers = await uploadVideoCovers(token, launch.advertiser_id, videoIds);
  const update = buildAddVideosUpdate(
    ad,
    videoIds.map((videoId) => ({ videoId, coverUri: covers[videoId] ?? null })),
  );
  if (!update.ok) return { ok: false, message: ADD_ERRORS[update.error] };

  await tiktokRequest({ path: "/smart_plus/ad/update/", method: "POST", accessToken: token, body: update.body });
  await createAdminClient()
    .from("campaign_launches")
    .update({ video_ids: [...new Set([...(launch.video_ids ?? []), ...update.added])] })
    .eq("id", launch.id);
  return { ok: true, added: update.added };
}
