/** Heurística: secondary_status de TikTok = no publicado por revisión. */
export function looksLikeRejectedAdStatus(secondaryStatus: string | null): boolean {
  const raw = (secondaryStatus ?? "").toUpperCase();
  if (!raw) return false;
  // AD_STATUS_AUDIT / IN_REVIEW son “en revisión”, no rechazo.
  if (/^(AD_STATUS_AUDIT|AD_STATUS_REAUDIT|IN_REVIEW|PENDING)$/.test(raw)) {
    return false;
  }
  return /AUDIT_DENY|PARTIAL_AUDIT|REVIEW_REJECT|REJECT|DENIED|DENY|NOT_APPROVE|NOT_PASS|DISAPPROVE|UNAVAILABLE|NOT_DELIVER|PUNISH/.test(
    raw,
  );
}

export const REJECT_REPEAT_LIMIT = 3;
export const REJECT_REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function countRecentSameKindRejects(input: {
  kind: TikTokRejectActionKind;
  recent: { kind: TikTokRejectActionKind; at: string }[];
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  return input.recent.filter((row) => {
    if (row.kind !== input.kind) return false;
    const ts = Date.parse(row.at);
    if (!Number.isFinite(ts)) return false;
    return now - ts <= REJECT_REPEAT_WINDOW_MS;
  }).length;
}

export function latestPolicyOrClaimsKind(
  rows: { reasons: string[]; at: string }[],
): "policy" | "claims" | null {
  const sorted = [...rows].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );
  const latest = sorted[0];
  if (!latest) return null;
  const kind = classifyTikTokRejectReasons(latest.reasons);
  if (kind === "policy" || kind === "claims") return kind;
  return null;
}

export function repeatRejectBlockMessage(
  kind: TikTokRejectActionKind,
  count: number,
): string {
  const what =
    kind === "policy"
      ? "una regla de TikTok"
      : kind === "claims"
        ? "promesas que TikTok no permite"
        : kind === "media_invalid"
          ? "un video que TikTok no puede usar"
          : kind === "landing"
            ? "la página de destino"
            : "el mismo problema";
  return `TikTok ya rechazó ${count} anuncios por ${what} en los últimos 7 días. No publiques otro igual: cambia el video y súbelo como corrección.`;
}

export type TikTokRejectActionKind =
  | "media_invalid"
  | "landing"
  | "policy"
  | "claims"
  | "generic";

/** Qué tiene que hacer el cliente. La página no se arregla subiendo otro video. */
export function clientFixAction(
  kind: TikTokRejectActionKind,
): "new_file" | "change_hook" | "fix_page" {
  if (kind === "media_invalid") return "new_file";
  if (kind === "landing") return "fix_page";
  return "change_hook";
}

export function classifyTikTokRejectReasons(
  reasons: string[],
): TikTokRejectActionKind {
  const blob = reasons.join(" \n ").toLowerCase();
  if (!blob.trim()) return "generic";

  if (
    /landing|p[aá]gina de destino|destination|privacy policy|pol[ií]tica de privacidad|precio no|price mismatch|el sitio|the website|url de destino/.test(
      blob,
    )
  ) {
    return "landing";
  }

  if (
    /unavailable|eliminad|expirad|inválid|invalid|deleted|expired|no.*(vídeo|video|imagen|image)|missing media|material/.test(
      blob,
    )
  ) {
    return "media_invalid";
  }
  if (
    /claim|engaños|misleading|exager|garant|cura|medical|salud|health|before.?after|p[eé]rdida de peso|bajar de peso|weight.?loss|quema de grasa|metabolismo|suplemento/i.test(
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

/** Motivo principal en español, sin el tutorial largo de Ads Manager. */
export function extractPrimaryRejectReason(reasons: string[]): string | null {
  const cleaned = reasons
    .map((reason) =>
      reason
        .replace(/\(\s*UNAVAILABLE\s*\)/gi, "")
        .replace(/\bUNAVAILABLE\b/gi, "")
        .replace(/\(\s*\)/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((reason) => reason.length > 12);

  const primary = cleaned.find(
    (reason) =>
      !/^modifica o elimina/i.test(reason) &&
      !/^para enviar una prueba/i.test(reason) &&
      !/^si quieres saber más/i.test(reason) &&
      !/inicia sesión en tiktok ads manager/i.test(reason),
  );
  const pick = primary || cleaned[0];
  if (!pick) return null;
  const sentence = pick.split(/\n+/)[0]?.trim() || pick;
  if (sentence.length > 220) return `${sentence.slice(0, 217).trim()}…`;
  return sentence;
}

/** Una línea corta para el cliente (sin jerga UNAVAILABLE / códigos). */
export function humanizeTikTokRejectReason(
  reasons: string[],
  fallback: string,
): string {
  const primary = extractPrimaryRejectReason(reasons);
  if (primary) return primary.length > 110 ? `${primary.slice(0, 107)}…` : primary;
  const kind = classifyTikTokRejectReasons(reasons);
  if (kind === "media_invalid") return fallback;
  const first = reasons.find((r) => r.trim().length > 0)?.trim();
  if (!first) return fallback;
  const clean = first
    .replace(/\s*\([^)]*(UNAVAILABLE|REJECT|AUDIT|CODE)[^)]*\)/gi, "")
    .replace(/\bUNAVAILABLE\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (clean.length < 8) return fallback;
  if (clean.length > 110) return `${clean.slice(0, 107)}…`;
  return clean;
}

