export type TikTokMediaPreview = {
  posterUrl: string | null;
  previewUrl: string | null;
};

function httpUrl(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^https?:\/\//i.test(text)) return null;
  return text;
}

/** Mapea la respuesta de file/video|image/ad/info a poster + preview. */
export function mapTikTokMediaPreviewRows(
  list: unknown,
): Map<string, TikTokMediaPreview> {
  const out = new Map<string, TikTokMediaPreview>();
  if (!Array.isArray(list)) return out;

  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = String(rec.video_id ?? rec.image_id ?? "").trim();
    if (!id) continue;
    const cover =
      httpUrl(rec.video_cover_url) ??
      httpUrl(rec.poster_url) ??
      httpUrl(rec.image_url);
    const previewCandidate =
      httpUrl(rec.video_url) ??
      httpUrl(rec.url) ??
      httpUrl(rec.preview_url);
    const normalized = normalizeMediaUrls({
      previewUrl: previewCandidate,
      posterUrl: cover,
    });
    // Si solo vino una imagen de cover/preview, guardarla como poster.
    if (
      !normalized.posterUrl &&
      previewCandidate &&
      isLikelyImageUrl(previewCandidate)
    ) {
      normalized.posterUrl = previewCandidate;
    }
    if (!normalized.posterUrl && !normalized.previewUrl) continue;
    out.set(id, {
      posterUrl: normalized.posterUrl,
      previewUrl: normalized.previewUrl,
    });
  }

  return out;
}

export function mediaKindFrom(input: {
  mimeType?: string | null;
  assetType?: string | null;
  previewUrl?: string | null;
  posterUrl?: string | null;
}): "video" | "image" | null {
  if (!input.previewUrl && !input.posterUrl) return null;
  const mime = (input.mimeType ?? "").toLowerCase();
  const kind = (input.assetType ?? "").toLowerCase();
  if (mime.startsWith("video/") || kind === "video") return "video";
  if (mime.startsWith("image/") || kind === "image") return "image";
  if (input.previewUrl && isLikelyImageUrl(input.previewUrl)) return "image";
  if (input.posterUrl && !input.previewUrl) return "image";
  if (input.previewUrl && isLikelyVideoUrl(input.previewUrl)) return "video";
  if (input.previewUrl && input.previewUrl !== input.posterUrl) return "video";
  if (input.previewUrl) return "video";
  return "image";
}

/** CDN de portada / imagen (no sirve como <video>). */
export function isLikelyImageUrl(url: string | null | undefined): boolean {
  const u = String(url ?? "").toLowerCase();
  if (!u) return false;
  if (/\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(u)) return true;
  return /ibyteimg\.com|byteimg\.com|image\.tiktokcdn|\/(?:image|cover|poster)\//i.test(
    u,
  );
}

export function isLikelyVideoUrl(url: string | null | undefined): boolean {
  const u = String(url ?? "").toLowerCase();
  if (!u) return false;
  if (isLikelyImageUrl(u)) return false;
  if (/\.(mp4|mov|webm|m3u8)(\?|$)/i.test(u)) return true;
  return /tiktokcdn\.com|\/video\//i.test(u);
}

/** Si TikTok dio una imagen como preview_url, úsala de poster y no como video. */
export function normalizeMediaUrls(input: {
  previewUrl: string | null;
  posterUrl: string | null;
}): {
  previewUrl: string | null;
  posterUrl: string | null;
  mediaKind: "video" | "image" | null;
} {
  let preview = input.previewUrl;
  let poster = input.posterUrl;

  if (preview && isLikelyImageUrl(preview)) {
    poster = poster || preview;
    preview = null;
  } else if (preview && !isLikelyVideoUrl(preview)) {
    // URL rara: mejor portada que un <video> vacío.
    poster = poster || preview;
    preview = null;
  }

  const mediaKind = mediaKindFrom({
    previewUrl: preview,
    posterUrl: poster,
  });
  return { previewUrl: preview, posterUrl: poster, mediaKind };
}

const VIDEO_NEST_KEYS = [
  "creative_list",
  "creative_info",
  "video_info",
  "media_info_list",
  "media_info",
  "creatives",
];

/** video_id dentro de creative_list de Smart+, no un id suelto. */
export function findNestedVideoId(value: unknown, depth = 0): string | null {
  if (depth > 8 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedVideoId(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const direct = String(row.video_id ?? "").trim();
  if (direct) return direct;
  for (const key of VIDEO_NEST_KEYS) {
    if (!(key in row)) continue;
    const found = findNestedVideoId(row[key], depth + 1);
    if (found) return found;
  }
  return null;
}

const TEXT_NEST_KEYS = [
  "creative_list",
  "creative_info",
  "ad_configuration",
  "media_info_list",
  "creatives",
];

/** Texto del anuncio dentro del payload Smart+. */
export function findNestedAdText(value: unknown, depth = 0): string | null {
  if (depth > 8 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedAdText(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const direct = String(row.ad_text ?? row.title ?? "").trim();
  if (direct.length >= 4) return direct.slice(0, 200);
  if (Array.isArray(row.ad_texts)) {
    const first = row.ad_texts
      .map((item) => String(item ?? "").trim())
      .find((item) => item.length >= 4);
    if (first) return first.slice(0, 200);
  }
  for (const key of TEXT_NEST_KEYS) {
    if (!(key in row)) continue;
    const found = findNestedAdText(row[key], depth + 1);
    if (found) return found;
  }
  return null;
}
