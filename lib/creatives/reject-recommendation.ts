/** Prefijo cacheado de recomendaciones IA (cliente + servidor). */
export const REJECT_REC_PREFIX = "REC|";

export const REJECT_EDIT_FOCI = [
  "video",
  "ad_text",
  "both",
  "appeal",
  "landing",
] as const;

export type RejectEditFocus = (typeof REJECT_EDIT_FOCI)[number];

export type RejectRecommendation = {
  /** Qué hacer, en lenguaje de cliente (no copiar Ads Manager). */
  plan: string;
  /** Ad text listo para pegar, si aplica. */
  adText: string | null;
  /** Texto corto para apelar cuando TikTok se equivoca. */
  appeal: string | null;
  /** Dónde está el arreglo, según el audio transcrito y el motivo. */
  editFocus: RejectEditFocus | null;
  /** Qué sacar o cambiar en lo que se dice en el video. */
  videoFix: string | null;
  /** Frase literal del voiceover que choca con el rechazo. */
  quote: string | null;
};

function asFocus(value: unknown): RejectEditFocus | null {
  return typeof value === "string" &&
    (REJECT_EDIT_FOCI as readonly string[]).includes(value)
    ? (value as RejectEditFocus)
    : null;
}

function asShort(value: unknown, min: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length >= min ? text : null;
}

function asObject(raw: string): RejectRecommendation | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const plan = typeof parsed.plan === "string" ? parsed.plan.trim() : "";
    if (plan.length < 8) return null;
    return {
      plan,
      adText: asShort(parsed.adText, 8),
      appeal: asShort(parsed.appeal, 8),
      editFocus: asFocus(parsed.editFocus),
      videoFix: asShort(parsed.videoFix, 8),
      quote: asShort(parsed.quote, 4),
    };
  } catch {
    return null;
  }
}

/** Lee REC| JSON o el formato viejo (solo texto plano). */
export function parseRejectRecommendation(
  raw: string | null | undefined,
): RejectRecommendation | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (text.startsWith("COPY|")) return null;
  if (text.startsWith(REJECT_REC_PREFIX)) {
    const body = text.slice(REJECT_REC_PREFIX.length).trim();
    if (!body) return null;
    if (body.startsWith("{")) return asObject(body);
    // Formato viejo: solo una frase
    return {
      plan: body,
      adText: null,
      appeal: null,
      editFocus: null,
      videoFix: null,
      quote: null,
    };
  }
  return {
    plan: text,
    adText: null,
    appeal: null,
    editFocus: null,
    videoFix: null,
    quote: null,
  };
}

export function encodeRejectRecommendation(
  rec: RejectRecommendation,
): string {
  return `${REJECT_REC_PREFIX}${JSON.stringify({
    plan: rec.plan,
    ...(rec.adText ? { adText: rec.adText } : {}),
    ...(rec.appeal ? { appeal: rec.appeal } : {}),
    ...(rec.editFocus ? { editFocus: rec.editFocus } : {}),
    ...(rec.videoFix ? { videoFix: rec.videoFix } : {}),
    ...(rec.quote ? { quote: rec.quote } : {}),
  })}`;
}

/** Hint que solo repite el copy genérico de TikTok → hay que regenerar con IA. */
export function isEchoTikTokHint(
  hint: string | null | undefined,
  tiktokSuggestions: string[] | null | undefined,
): boolean {
  const rec = parseRejectRecommendation(hint);
  if (!rec?.plan) return true;
  const plan = rec.plan.toLowerCase();
  if (/modifica el producto o servicio promocionado/i.test(plan)) return true;
  if (/pol[ií]ticas publicitarias de tiktok/i.test(plan) && plan.length > 120) {
    return true;
  }
  for (const tip of tiktokSuggestions ?? []) {
    const tipClean = tip.replace(/\s+/g, " ").trim().toLowerCase();
    if (!tipClean) continue;
    if (plan === tipClean || tipClean.includes(plan) || plan.includes(tipClean.slice(0, 80))) {
      return true;
    }
  }
  return false;
}
