/** Heurística: motivo TikTok → tip de acción (sin llamar a IA). */
export type TikTokRejectActionKind =
  | "media_invalid"
  | "policy"
  | "claims"
  | "generic";

export function classifyTikTokRejectReasons(
  reasons: string[],
): TikTokRejectActionKind {
  const blob = reasons.join(" \n ").toLowerCase();
  if (!blob.trim()) return "generic";

  if (
    /eliminad|expirad|inválid|invalid|deleted|expired|no.*(vídeo|video|imagen|image)|missing media|material/.test(
      blob,
    )
  ) {
    return "media_invalid";
  }
  if (
    /claim|engaños|misleading|exager|garant|cura|medical|salud|health|before.?after/.test(
      blob,
    )
  ) {
    return "claims";
  }
  if (
    /polític|politic|policy|infracc|violation|prohibid|banned|restricted|región|region/.test(
      blob,
    )
  ) {
    return "policy";
  }
  return "generic";
}
