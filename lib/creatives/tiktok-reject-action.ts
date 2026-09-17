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
    /unavailable|eliminad|expirad|inválid|invalid|deleted|expired|no.*(vídeo|video|imagen|image)|missing media|material/.test(
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

/** Una línea corta para el cliente (sin jerga UNAVAILABLE / códigos). */
export function humanizeTikTokRejectReason(
  reasons: string[],
  fallback: string,
): string {
  const kind = classifyTikTokRejectReasons(reasons);
  if (kind === "media_invalid") return fallback;
  const first = reasons.find((r) => r.trim().length > 0)?.trim();
  if (!first) return fallback;
  // Quitar códigos técnicos entre paréntesis
  const clean = first
    .replace(/\s*\([^)]*(UNAVAILABLE|REJECT|AUDIT|CODE)[^)]*\)/gi, "")
    .replace(/\bUNAVAILABLE\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (clean.length < 8) return fallback;
  if (clean.length > 110) return `${clean.slice(0, 107)}…`;
  return clean;
}

