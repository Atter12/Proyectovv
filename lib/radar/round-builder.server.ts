import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTikTokOembed } from "@/lib/radar/oembed.server";
import { forEachUntil } from "@/lib/radar/job-runs.server";
import { getRadarProfile, saveRadarProfile, type RadarProfile } from "@/lib/radar/profiles.server";
import { pickDiverseRound, pickPersonalRound, type PoolVideo } from "@/lib/radar/rounds";
import { normalizeTags, type VideoTags } from "@/lib/radar/tags";
import { computeTaste, type Reaction } from "@/lib/radar/taste";

/** Tamaño de cada ronda y videos de reserva para reemplazar los que mueran. */
export const ROUND_SIZE = { 1: 12, 2: 8 } as const;
const RESERVES = 6;
/** Solo videos vistos en tendencia en las últimas semanas. */
const POOL_MAX_AGE_DAYS = 21;

export type RadarRound = 1 | 2;

export type RoundVideo = {
  videoId: string;
  shareUrl: string;
  authorName: string | null;
  authorHandle: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  tags: VideoTags;
  hashtags: string[];
  countryCode: string | null;
};

export type RoundPayload = {
  round: RadarRound;
  videos: RoundVideo[];
  reserves: RoundVideo[];
  poolSize: number;
  /** true si no hubo videos del primer país configurado (se usó la región). */
  regionFallback: boolean;
};

type PoolEntry = PoolVideo & Omit<RoundVideo, "thumbnailUrl"> & { countryIndex: number };

async function loadPool(category: string): Promise<PoolEntry[]> {
  const admin = createAdminClient();
  const countries = serverEnv.radarCountryCodes;
  const since = shiftYmd(todayYmdInTz("America/Lima"), -POOL_MAX_AGE_DAYS);
  const { data, error } = await admin
    .from("radar_video_sources")
    .select(
      "video_id, country_code, hashtag_name, discovery_rank, radar_videos!inner(share_url, author_name, author_handle, caption, tags, status)",
    )
    .eq("category_name", category)
    .in("country_code", countries)
    .gte("last_seen_date", since)
    .eq("radar_videos.status", "alive")
    .limit(2000);
  if (error) throw new Error(`radar_video_sources: ${error.message}`);

  const byVideo = new Map<string, PoolEntry>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const video = (Array.isArray(row.radar_videos) ? row.radar_videos[0] : row.radar_videos) as
      | Record<string, unknown>
      | undefined;
    if (!video) continue;
    const videoId = String(row.video_id);
    const country = String(row.country_code);
    const countryIndex = Math.max(0, countries.indexOf(country));
    // El país preferido va primero: su posición pesa como si fuera 100 puestos mejor.
    const rank = Number(row.discovery_rank ?? 20) + countryIndex * 100;
    const existing = byVideo.get(videoId);
    const hashtag = String(row.hashtag_name ?? "");
    if (existing) {
      if (rank < (existing.bestRank ?? Infinity)) {
        existing.bestRank = rank;
        existing.countryCode = country;
        existing.countryIndex = countryIndex;
      }
      if (hashtag && !existing.hashtags.includes(hashtag)) existing.hashtags.push(hashtag);
      continue;
    }
    byVideo.set(videoId, {
      videoId,
      bestRank: rank,
      tags: normalizeTags(video.tags),
      shareUrl: String(video.share_url ?? ""),
      authorName: (video.author_name as string | null) ?? null,
      authorHandle: (video.author_handle as string | null) ?? null,
      caption: (video.caption as string | null) ?? null,
      hashtags: hashtag ? [hashtag] : [],
      countryCode: country,
      countryIndex,
    });
  }
  return [...byVideo.values()].filter((v) => v.shareUrl);
}

async function reactedVideoIds(hecomClienteId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("radar_reactions")
    .select("video_id")
    .eq("hecom_cliente_id", hecomClienteId);
  if (error) throw new Error(`radar_reactions: ${error.message}`);
  return new Set((data ?? []).map((r) => String(r.video_id)));
}

/** Completa miniatura y texto con oEmbed; los muertos se marcan y se descartan. */
async function enrich(entries: PoolEntry[]): Promise<RoundVideo[]> {
  const admin = createAdminClient();
  const out = new Map<string, RoundVideo>();
  const dead = new Set<string>();
  await forEachUntil(entries, 6, Date.now() + 9000, async (entry) => {
    const oembed = await fetchTikTokOembed(entry.shareUrl);
    if (oembed.kind === "dead") {
      dead.add(entry.videoId);
      await admin
        .from("radar_videos")
        .update({ status: "dead", dead_reason: oembed.reason, last_checked_at: new Date().toISOString() })
        .eq("video_id", entry.videoId);
      return;
    }
    out.set(entry.videoId, {
      videoId: entry.videoId,
      shareUrl: entry.shareUrl,
      authorName: oembed.kind === "alive" ? (oembed.authorName ?? entry.authorName) : entry.authorName,
      authorHandle: entry.authorHandle,
      caption: oembed.kind === "alive" ? (oembed.title ?? entry.caption) : entry.caption,
      thumbnailUrl: oembed.kind === "alive" ? oembed.thumbnailUrl : null,
      tags: entry.tags,
      hashtags: entry.hashtags.slice(0, 4),
      countryCode: entry.countryCode,
    });
  });
  // Mantener el orden elegido, sin los muertos; los que no alcanzaron a
  // revisarse quedan sin miniatura.
  return entries
    .filter((e) => !dead.has(e.videoId))
    .map((e) =>
      out.get(e.videoId) ?? {
        videoId: e.videoId,
        shareUrl: e.shareUrl,
        authorName: e.authorName,
        authorHandle: e.authorHandle,
        caption: e.caption,
        thumbnailUrl: null,
        tags: e.tags,
        hashtags: e.hashtags.slice(0, 4),
        countryCode: e.countryCode,
      },
    );
}

export async function buildRound(input: {
  profile: RadarProfile;
  round: RadarRound;
}): Promise<RoundPayload> {
  const { profile, round } = input;
  if (!profile.categoryName) throw new Error("Primero elige tu rubro.");

  const pool = await loadPool(profile.categoryName);
  const exclude = await reactedVideoIds(profile.hecomClienteId);
  const size = ROUND_SIZE[round];
  const pick =
    round === 1
      ? pickDiverseRound(pool, size, exclude, RESERVES)
      : pickPersonalRound(pool, profile.taste, size, exclude, RESERVES);

  const byId = new Map(pool.map((p) => [p.videoId, p]));
  const chosen = [...pick.selected, ...pick.reserves].map((p) => byId.get(p.videoId)!).filter(Boolean);
  const enriched = await enrich(chosen);

  // Los que murieron al revisarlos ya no están: las reservas suben a ocupar su
  // lugar, sin avisar al cliente.
  const videos = enriched.slice(0, size);
  const reserves = enriched.slice(size);

  return {
    round,
    videos,
    reserves,
    poolSize: pool.length,
    regionFallback: pool.length > 0 && !pool.some((p) => p.countryIndex === 0),
  };
}

/**
 * Guarda las reacciones de una ronda, recalcula el gusto con todas las
 * reacciones del cliente y avanza el paso del arranque.
 */
export async function saveRoundReactions(input: {
  hecomClienteId: string;
  round: RadarRound;
  reactions: Array<{ videoId: string; reaction: Reaction }>;
}): Promise<RadarProfile> {
  const admin = createAdminClient();
  const rows = input.reactions
    .filter((r) => r.videoId && ["like", "dislike", "pick"].includes(r.reaction))
    .map((r) => ({
      hecom_cliente_id: input.hecomClienteId,
      video_id: r.videoId,
      round: input.round,
      reaction: r.reaction,
    }));
  if (rows.length > 0) {
    const { error } = await admin
      .from("radar_reactions")
      .upsert(rows, { onConflict: "hecom_cliente_id,video_id,round" });
    if (error) throw new Error(`radar_reactions: ${error.message}`);
  }

  const { data, error } = await admin
    .from("radar_reactions")
    .select("reaction, radar_videos(tags)")
    .eq("hecom_cliente_id", input.hecomClienteId);
  if (error) throw new Error(`radar_reactions: ${error.message}`);

  const taste = computeTaste(
    ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const video = (Array.isArray(row.radar_videos) ? row.radar_videos[0] : row.radar_videos) as
        | { tags?: unknown }
        | undefined;
      return { tags: normalizeTags(video?.tags), reaction: row.reaction as Reaction };
    }),
  );

  const current = await getRadarProfile(input.hecomClienteId);
  const nextStep = input.round === 1 ? "round2" : "done";
  const keepStep = current?.onboardingStep === "done" && input.round === 1;
  return saveRadarProfile(input.hecomClienteId, {
    taste,
    onboardingStep: keepStep ? "done" : nextStep,
  });
}

/** Marca un video como muerto solo si oEmbed lo confirma (no se confía en el navegador). */
export async function confirmVideoDead(videoId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("radar_videos").select("share_url").eq("video_id", videoId).maybeSingle();
  if (!data?.share_url) return false;
  const oembed = await fetchTikTokOembed(String(data.share_url));
  if (oembed.kind !== "dead") return false;
  await admin
    .from("radar_videos")
    .update({ status: "dead", dead_reason: oembed.reason, last_checked_at: new Date().toISOString() })
    .eq("video_id", videoId);
  return true;
}
