import "server-only";
import { fetchTikTokOembed } from "@/lib/radar/oembed.server";
import { saveRadarProfile, type RadarProfile } from "@/lib/radar/profiles.server";
import { pickDiverseRound, pickPersonalRound } from "@/lib/radar/rounds";
import { computeTaste, mergeTaste, type Reaction } from "@/lib/radar/taste";
import { buildLivePool, readVideoToken, type LiveVideo } from "@/lib/radar/live-pool.server";

/** Tamaño de cada ronda y videos de reserva para reemplazar los que no carguen. */
export const ROUND_SIZE = { 1: 12, 2: 8 } as const;
const RESERVES = 6;
/** Búsquedas de Google por ronda (cada una cuesta 1 crédito de Serper). */
const QUERIES_PER_ROUND = 6;

export type RadarRound = 1 | 2;

export type RoundVideo = Omit<LiveVideo, "bestRank">;

export type RoundPayload = {
  round: RadarRound;
  videos: RoundVideo[];
  reserves: RoundVideo[];
  poolSize: number;
  /** Se mantiene por compatibilidad con la pantalla; la búsqueda en vivo es de un solo país. */
  regionFallback: boolean;
};

function toRoundVideo(video: LiveVideo): RoundVideo {
  const { bestRank, ...rest } = video;
  void bestRank;
  return rest;
}

/**
 * Arma la ronda buscando en vivo. Nada se guarda: los videos viajan firmados
 * y el navegador manda la lista de los ya vistos para no repetirlos.
 */
export async function buildRound(input: {
  profile: RadarProfile;
  round: RadarRound;
  exclude: ReadonlySet<string>;
  deadlineMs: number;
}): Promise<RoundPayload> {
  const { profile, round } = input;
  if (!profile.categoryName) throw new Error("Primero elige tu rubro.");

  const live = await buildLivePool({
    category: profile.categoryName,
    products: profile.products,
    // La ronda 2 mira la segunda página de Google para traer videos nuevos.
    page: round === 2 ? 2 : 1,
    maxQueries: QUERIES_PER_ROUND,
    exclude: input.exclude,
    deadlineMs: input.deadlineMs,
  });
  if (live.error) console.warn("[radar] live_pool_error", { error: live.error });

  const pool = live.videos;
  const size = ROUND_SIZE[round];
  const pick =
    round === 1
      ? pickDiverseRound(pool, size, input.exclude, RESERVES)
      : pickPersonalRound(pool, profile.taste, size, input.exclude, RESERVES);

  const byId = new Map(pool.map((v) => [v.videoId, v]));
  const toVideos = (list: Array<{ videoId: string }>) =>
    list.map((p) => byId.get(p.videoId)).filter((v): v is LiveVideo => Boolean(v)).map(toRoundVideo);

  console.info("[radar] live_round", {
    round,
    category: profile.categoryName,
    queries: live.queries,
    found: live.found,
    pool: pool.length,
  });
  return {
    round,
    videos: toVideos(pick.selected),
    reserves: toVideos(pick.reserves),
    poolSize: pool.length,
    regionFallback: false,
  };
}

/**
 * Convierte lo que el cliente marcó en su gusto. Sin biblioteca de videos no se
 * guarda cada reacción: la ronda 1 arma el gusto desde cero y la ronda 2 se le
 * suma. Solo cuentan videos con firma válida.
 */
export async function saveRoundReactions(input: {
  profile: RadarProfile;
  round: RadarRound;
  reactions: Array<{ token: unknown; reaction: Reaction }>;
}): Promise<RadarProfile> {
  const items = input.reactions
    .map((r) => ({ video: readVideoToken(r.token), reaction: r.reaction }))
    .filter((r): r is { video: NonNullable<ReturnType<typeof readVideoToken>>; reaction: Reaction } => Boolean(r.video))
    .map((r) => ({ tags: r.video.tags, reaction: r.reaction }));

  const roundTaste = computeTaste(items);
  const taste = input.round === 1 ? roundTaste : mergeTaste(input.profile.taste, roundTaste);
  const keepStep = input.profile.onboardingStep === "done" && input.round === 1;
  return saveRadarProfile(input.profile.hecomClienteId, {
    taste,
    onboardingStep: keepStep ? "done" : input.round === 1 ? "round2" : "done",
  });
}

/** El reproductor avisó que un video no carga: se confirma con oEmbed (no se confía en el navegador). */
export async function confirmVideoDead(token: unknown): Promise<boolean> {
  const video = readVideoToken(token);
  if (!video) return false;
  const oembed = await fetchTikTokOembed(video.shareUrl);
  return oembed.kind === "dead";
}
