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
    const poster =
      httpUrl(rec.video_cover_url) ??
      httpUrl(rec.poster_url) ??
      httpUrl(rec.image_url);
    const preview =
      httpUrl(rec.preview_url) ?? httpUrl(rec.video_url) ?? poster;
    if (!poster && !preview) continue;
    out.set(id, { posterUrl: poster, previewUrl: preview });
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
  if (input.previewUrl && input.previewUrl !== input.posterUrl) return "video";
  if (input.previewUrl) return "video";
  return "image";
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
