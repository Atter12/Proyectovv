/** Prefijo cacheado de recomendaciones (cliente + servidor). */
export const REJECT_REC_PREFIX = "REC|";

export function parseRejectRecommendation(
  raw: string | null | undefined,
): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (text.startsWith(REJECT_REC_PREFIX)) {
    return text.slice(REJECT_REC_PREFIX.length).trim() || null;
  }
  // Cache viejo COPY|: no se muestra (eran textos inventados).
  if (text.startsWith("COPY|")) return null;
  return text;
}
