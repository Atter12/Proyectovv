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
          : "el mismo problema";
  return `TikTok ya rechazó ${count} anuncios por ${what} en los últimos 7 días. No publiques otro igual: cambia el video y súbelo como corrección.`;
}

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

