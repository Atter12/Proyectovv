import "server-only";
import { listTikTokPixels } from "@/lib/integrations/tiktok/pixel.server";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import type { SmartPlusIdentity } from "@/lib/campaigns/smart-plus-plan";

export type LaunchIdentity = SmartPlusIdentity & { name: string };

export type LaunchOptions = {
  pixels: { id: string; name: string }[];
  /** Solo perfiles de esta cuenta: nunca los de otros clientes del BC. */
  identities: LaunchIdentity[];
  videos: { videoId: string; name: string; coverUrl: string | null; durationSec: number | null }[];
};

/** Videos recientes que se ofrecen para la campaña. */
const VIDEO_LIMIT = 24;

type UsedIdentity = { type: SmartPlusIdentity["type"]; bcId: string | null };

/**
 * Perfiles de TikTok que esta cuenta puede usar para publicar. /identity/get/
 * devuelve también los perfiles autorizados a todo el BC (de otros clientes),
 * y no trae los que el cliente conectó con su propio login. Por eso la lista
 * sale de:
 *   - perfiles propios de la cuenta (CUSTOMIZED_USER, se crean dentro de ella)
 *   - perfiles que la cuenta ya usó en sus anuncios (con su nombre de /identity/info/)
 */
export async function loadAccountIdentities(accessToken: string, advertiserId: string): Promise<LaunchIdentity[]> {
  const [custom, used] = await Promise.all([
    tiktokRequest<{ identity_list?: Record<string, unknown>[] }>({
      path: "/identity/get/",
      accessToken,
      query: { advertiser_id: advertiserId, identity_type: "CUSTOMIZED_USER", page_size: "100" },
    })
      .then((r) =>
        (r.identity_list ?? [])
          .map((i) => ({
            type: "CUSTOMIZED_USER" as const,
            id: String(i.identity_id ?? ""),
            bcId: null,
            name: String(i.display_name ?? i.identity_id ?? ""),
          }))
          .filter((i) => i.id),
      )
      .catch(() => [] as LaunchIdentity[]),
    identitiesUsedInAds(accessToken, advertiserId),
  ]);

  const out = new Map<string, LaunchIdentity>(custom.map((i) => [i.id, i]));
  await Promise.all(
    [...used.entries()]
      .filter(([id]) => !out.has(id))
      .slice(0, 10)
      .map(async ([id, ref]) => {
        const name = await tiktokRequest<{ identity_info?: Record<string, unknown> }>({
          path: "/identity/info/",
          accessToken,
          query: {
            advertiser_id: advertiserId,
            identity_type: ref.type,
            identity_id: id,
            ...(ref.bcId ? { identity_authorized_bc_id: ref.bcId } : {}),
          },
        })
          .then((r) => String(r.identity_info?.display_name ?? "").trim())
          .catch(() => "");
        out.set(id, { type: ref.type, id, bcId: ref.bcId, name: name || `Perfil de sus anuncios · ${id.slice(0, 8)}` });
      }),
  );
  return [...out.values()];
}

const IDENTITY_TYPES = new Set(["TT_USER", "CUSTOMIZED_USER", "BC_AUTH_TT"]);

/** Perfiles que aparecen en los anuncios de la cuenta (clásicos y Smart+). */
async function identitiesUsedInAds(accessToken: string, advertiserId: string): Promise<Map<string, UsedIdentity>> {
  const used = new Map<string, UsedIdentity>();
  const add = (row: Record<string, unknown> | undefined) => {
    const id = typeof row?.identity_id === "string" ? row.identity_id.trim() : "";
    const type = String(row?.identity_type ?? "");
    if (!id || !IDENTITY_TYPES.has(type) || used.has(id)) return;
    const bcId = row?.identity_authorized_bc_id ? String(row.identity_authorized_bc_id) : null;
    used.set(id, { type: type as UsedIdentity["type"], bcId });
  };
  await Promise.all([
    tiktokRequest<{ list?: Record<string, unknown>[] }>({
      path: "/ad/get/",
      accessToken,
      query: {
        advertiser_id: advertiserId,
        fields: ["identity_id", "identity_type", "identity_authorized_bc_id"],
        page_size: "100",
      },
    })
      .then((r) => (r.list ?? []).forEach((ad) => add(ad)))
      .catch(() => undefined),
    tiktokRequest<{ list?: Record<string, unknown>[] }>({
      path: "/smart_plus/ad/get/",
      accessToken,
      query: { advertiser_id: advertiserId, page_size: "100" },
    })
      .then((r) =>
        (r.list ?? []).forEach((ad) => {
          add(ad.ad_configuration as Record<string, unknown> | undefined);
          for (const c of (ad.creative_list as Record<string, unknown>[] | undefined) ?? []) {
            add(c.creative_info as Record<string, unknown> | undefined);
          }
        }),
      )
      .catch(() => undefined),
  ]);
  return used;
}

/**
 * Lo que hace falta para lanzar una campaña en una cuenta: píxeles, perfiles
 * de TikTok de esa cuenta y los videos de su biblioteca. Si una parte falla,
 * viene vacía (la pantalla avisa qué falta).
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

  const videosTask = listAccountVideos(accessToken, advertiserId).catch(() => []);

  const [pixels, identities, videos] = await Promise.all([
    pixelsTask,
    loadAccountIdentities(accessToken, advertiserId).catch(() => []),
    videosTask,
  ]);
  return { pixels, identities, videos };
}

/** Videos más recientes de la biblioteca de la cuenta. */
export async function listAccountVideos(accessToken: string, advertiserId: string): Promise<LaunchOptions["videos"]> {
  const r = await tiktokRequest<{ list?: Record<string, unknown>[] }>({
    path: "/file/video/ad/search/",
    accessToken,
    query: { advertiser_id: advertiserId, page_size: String(VIDEO_LIMIT) },
  });
  return (r.list ?? [])
    .filter((v) => v.video_id)
    .sort((a, b) => String(b.create_time ?? "").localeCompare(String(a.create_time ?? "")))
    .map((v) => ({
      videoId: String(v.video_id),
      name: String(v.file_name ?? v.video_id),
      coverUrl: typeof v.video_cover_url === "string" ? v.video_cover_url : null,
      durationSec: typeof v.duration === "number" ? Math.round(v.duration) : null,
    }));
}

/** Crea un perfil propio de la cuenta (nombre de la tienda) para publicar. */
export async function createAccountIdentity(accessToken: string, advertiserId: string, displayName: string): Promise<LaunchIdentity> {
  const name = displayName.trim().slice(0, 40) || "Tienda";
  const res = await tiktokRequest<{ identity_id?: string }>({
    path: "/identity/create/",
    method: "POST",
    accessToken,
    body: { advertiser_id: advertiserId, display_name: name },
  });
  if (!res.identity_id) throw new Error("TikTok no devolvió el perfil creado.");
  return { type: "CUSTOMIZED_USER", id: String(res.identity_id), bcId: null, name };
}
