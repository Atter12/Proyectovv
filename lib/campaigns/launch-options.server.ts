import "server-only";
import { listTikTokPixels } from "@/lib/integrations/tiktok/pixel.server";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import type { SmartPlusIdentity } from "@/lib/campaigns/smart-plus-plan";

export type LaunchOptions = {
  pixels: { id: string; name: string }[];
  identities: (SmartPlusIdentity & { name: string })[];
  videos: { videoId: string; name: string; coverUrl: string | null; durationSec: number | null }[];
};

/** Videos recientes que se ofrecen para la campaña. */
const VIDEO_LIMIT = 24;

/**
 * Lo que hace falta para lanzar una campaña en una cuenta: píxeles, identidades
 * de TikTok (quién "publica" el anuncio) y los videos de su biblioteca.
 * Si una parte falla, viene vacía (la pantalla avisa qué falta).
 */
export async function loadLaunchOptions(input: {
  accessToken: string;
  advertiserId: string;
  organizationId?: string;
}): Promise<LaunchOptions> {
  const { accessToken, advertiserId } = input;

  const pixelsTask = listTikTokPixels({ advertiserId, organizationId: input.organizationId })
    .then((r) => r.pixels.map((p) => ({ id: p.pixelId, name: p.pixelName || p.pixelId })))
    .catch(() => []);

  const identitiesTask = Promise.all(
    (["CUSTOMIZED_USER", "TT_USER", "BC_AUTH_TT"] as const).map((type) =>
      tiktokRequest<{ identity_list?: Record<string, unknown>[] }>({
        path: "/identity/get/",
        accessToken,
        query: { advertiser_id: advertiserId, identity_type: type, page_size: "50" },
      })
        .then((r) =>
          (r.identity_list ?? []).map((i) => ({
            type,
            id: String(i.identity_id ?? ""),
            bcId: i.identity_authorized_bc_id ? String(i.identity_authorized_bc_id) : null,
            name: String(i.display_name ?? i.identity_id ?? ""),
          })),
        )
        .catch(() => []),
    ),
  ).then((groups) => groups.flat().filter((i) => i.id));

  const videosTask = tiktokRequest<{ list?: Record<string, unknown>[] }>({
    path: "/file/video/ad/search/",
    accessToken,
    query: { advertiser_id: advertiserId, page_size: String(VIDEO_LIMIT) },
  })
    .then((r) =>
      (r.list ?? [])
        .filter((v) => v.video_id)
        .sort((a, b) => String(b.create_time ?? "").localeCompare(String(a.create_time ?? "")))
        .map((v) => ({
          videoId: String(v.video_id),
          name: String(v.file_name ?? v.video_id),
          coverUrl: typeof v.video_cover_url === "string" ? v.video_cover_url : null,
          durationSec: typeof v.duration === "number" ? Math.round(v.duration) : null,
        })),
    )
    .catch(() => []);

  const [pixels, identities, videos] = await Promise.all([pixelsTask, identitiesTask, videosTask]);
  return { pixels, identities, videos };
}
