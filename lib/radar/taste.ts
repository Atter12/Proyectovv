import type { TagDimension, VideoTags } from "./tags";

/**
 * Perfil de gusto del cliente (sin dependencias, para tests).
 *
 * Pesos por etiqueta calculados desde cero con todas sus reacciones, así
 * rehacer el cálculo nunca cuenta dos veces la misma reacción. Modelo simple y
 * explicable: cada "me gusta" suma, cada "no me gusta" resta, elegir un video
 * en la ronda reducida pesa más.
 */

export type Reaction = "like" | "dislike" | "pick";
export type Taste = Partial<Record<TagDimension, Record<string, number>>>;

export const REACTION_WEIGHT: Record<Reaction, number> = {
  like: 1,
  pick: 1.5,
  dislike: -1,
};

function entries(tags: VideoTags): Array<[TagDimension, string]> {
  return (Object.entries(tags) as Array<[TagDimension, string | undefined]>).filter(
    (entry): entry is [TagDimension, string] => typeof entry[1] === "string" && entry[1].length > 0,
  );
}

export function computeTaste(items: Array<{ tags: VideoTags; reaction: Reaction }>): Taste {
  const taste: Taste = {};
  for (const item of items) {
    const weight = REACTION_WEIGHT[item.reaction] ?? 0;
    for (const [dimension, value] of entries(item.tags)) {
      const bucket = (taste[dimension] ??= {});
      bucket[value] = Math.round(((bucket[value] ?? 0) + weight) * 100) / 100;
    }
  }
  return taste;
}

/** Cuánto encaja un video con el gusto del cliente (más alto = mejor). */
export function scoreVideo(taste: Taste, tags: VideoTags): number {
  let score = 0;
  for (const [dimension, value] of entries(tags)) score += taste[dimension]?.[value] ?? 0;
  return Math.round(score * 100) / 100;
}

/** Lo que más le gusta, por dimensión (solo pesos positivos), de mayor a menor. */
export function topPreferences(
  taste: Taste,
  perDimension = 1,
): Array<{ dimension: TagDimension; value: string; weight: number }> {
  const out: Array<{ dimension: TagDimension; value: string; weight: number }> = [];
  for (const [dimension, values] of Object.entries(taste) as Array<[TagDimension, Record<string, number>]>) {
    const ranked = Object.entries(values)
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, perDimension);
    for (const [value, weight] of ranked) out.push({ dimension, value, weight });
  }
  return out.sort((a, b) => b.weight - a.weight);
}
