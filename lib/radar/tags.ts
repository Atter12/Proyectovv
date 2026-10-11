/**
 * Vocabulario de etiquetas del Radar (sin dependencias, para tests).
 *
 * Cada video de la biblioteca lleva a lo sumo un valor por dimensión. Con las
 * reacciones del cliente se aprende cuánto le gusta cada valor (taste.ts) y se
 * eligen los videos de cada ronda (rounds.ts). Los textos visibles viven en
 * messages/*.json → profit.radar.tags.<dimensión>.<valor>.
 */

export const TAG_DIMENSIONS = {
  presenter: ["owner", "presenter", "hands_product", "no_person", "avatar"],
  production: ["homemade", "produced"],
  format: ["testimonial", "demo", "before_after", "unboxing", "tutorial", "humor", "story", "pov"],
  tone: ["direct", "emotional", "educational", "funny", "aspirational"],
  pace: ["fast", "medium", "slow"],
  audio: ["talking", "voiceover", "trending_music", "text_only"],
  hook: ["price", "problem", "result", "question", "curiosity"],
  positioning: ["mass", "premium"],
} as const;

export type TagDimension = keyof typeof TAG_DIMENSIONS;
export type TagValue<D extends TagDimension = TagDimension> = (typeof TAG_DIMENSIONS)[D][number];
export type VideoTags = { [D in TagDimension]?: TagValue<D> };

export const TAG_DIMENSION_LIST = Object.keys(TAG_DIMENSIONS) as TagDimension[];

export function isTagValue(dimension: TagDimension, value: unknown): boolean {
  return typeof value === "string" && (TAG_DIMENSIONS[dimension] as readonly string[]).includes(value);
}

/** Deja solo dimensiones y valores conocidos (lo que devuelve la IA se filtra aquí). */
export function normalizeTags(raw: unknown): VideoTags {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out as VideoTags;
  for (const dimension of TAG_DIMENSION_LIST) {
    const value = (raw as Record<string, unknown>)[dimension];
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : value;
    if (isTagValue(dimension, normalized)) out[dimension] = normalized as string;
  }
  return out as VideoTags;
}

/** Claves "dimensión:valor" de un video, útiles para medir variedad. */
export function tagKeys(tags: VideoTags): string[] {
  return TAG_DIMENSION_LIST.filter((d) => tags[d]).map((d) => `${d}:${tags[d]}`);
}
