import type { VideoTags } from "./tags";
import type { Taste } from "./taste";

/**
 * Selección de videos para las rondas del Radar (sin dependencias, para tests).
 *
 * Ronda 1 (amplia): máxima variedad de etiquetas, para que cada reacción del
 * cliente enseñe algo distinto. Ronda 2 (reducida): los que mejor encajan con
 * su perfil de gusto, sin que todos sean del mismo formato.
 * Cada ronda trae videos de reserva para reemplazar en silencio los que mueran.
 */

export type PoolVideo = {
  videoId: string;
  tags: VideoTags;
  /** Mejor posición del video en el top de algún hashtag (1 = mejor). */
  bestRank: number | null;
};

export type RoundPick = { selected: PoolVideo[]; reserves: PoolVideo[] };

function keysOf(tags: VideoTags): string[] {
  return Object.entries(tags)
    .filter(([, v]) => typeof v === "string" && v)
    .map(([d, v]) => `${d}:${v}`);
}

function rankOf(video: PoolVideo): number {
  return video.bestRank ?? Number.MAX_SAFE_INTEGER;
}

function available(pool: PoolVideo[], exclude: ReadonlySet<string>): PoolVideo[] {
  const seen = new Set<string>();
  return pool.filter((v) => {
    if (exclude.has(v.videoId) || seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });
}

function takeReserves(candidates: PoolVideo[], selected: PoolVideo[], count: number): PoolVideo[] {
  const chosen = new Set(selected.map((v) => v.videoId));
  return candidates.filter((v) => !chosen.has(v.videoId)).slice(0, Math.max(0, count));
}

/**
 * Ronda amplia: en cada paso toma el video que aporta más etiquetas aún no
 * vistas en la ronda; a igualdad, el de mejor posición en TikTok.
 */
export function pickDiverseRound(
  pool: PoolVideo[],
  size: number,
  exclude: ReadonlySet<string> = new Set(),
  reserveCount = 0,
): RoundPick {
  const candidates = available(pool, exclude).sort((a, b) => rankOf(a) - rankOf(b));
  const covered = new Set<string>();
  const selected: PoolVideo[] = [];
  const remaining = [...candidates];

  while (selected.length < size && remaining.length > 0) {
    let bestIndex = 0;
    let bestGain = -1;
    remaining.forEach((video, index) => {
      const gain = keysOf(video.tags).filter((k) => !covered.has(k)).length;
      if (gain > bestGain) {
        bestGain = gain;
        bestIndex = index;
      }
    });
    const [video] = remaining.splice(bestIndex, 1);
    selected.push(video!);
    for (const key of keysOf(video!.tags)) covered.add(key);
  }

  return { selected, reserves: takeReserves(candidates, selected, reserveCount) };
}

/**
 * Ronda reducida: ordena por encaje con el gusto (y posición en TikTok a
 * igualdad) y limita cuántos videos del mismo formato entran, para que la
 * ronda no sea toda igual.
 */
export function pickPersonalRound(
  pool: PoolVideo[],
  taste: Taste,
  size: number,
  exclude: ReadonlySet<string> = new Set(),
  reserveCount = 0,
  maxPerFormat = Math.max(2, Math.ceil(size / 2)),
): RoundPick {
  const scoreOf = (tags: VideoTags) => {
    let s = 0;
    for (const [d, v] of Object.entries(tags)) {
      if (typeof v === "string") s += (taste as Record<string, Record<string, number> | undefined>)[d]?.[v] ?? 0;
    }
    return s;
  };
  const ranked = available(pool, exclude)
    .map((video) => ({ video, score: scoreOf(video.tags) }))
    .sort((a, b) => b.score - a.score || rankOf(a.video) - rankOf(b.video))
    .map((x) => x.video);

  const perFormat = new Map<string, number>();
  const selected: PoolVideo[] = [];
  const skipped: PoolVideo[] = [];
  for (const video of ranked) {
    if (selected.length >= size) break;
    const format = video.tags.format ?? "";
    const count = perFormat.get(format) ?? 0;
    if (format && count >= maxPerFormat) {
      skipped.push(video);
      continue;
    }
    perFormat.set(format, count + 1);
    selected.push(video);
  }
  // Si el límite por formato dejó la ronda corta, se completa con lo saltado.
  for (const video of skipped) {
    if (selected.length >= size) break;
    selected.push(video);
  }

  return { selected, reserves: takeReserves(ranked, selected, reserveCount) };
}
