const LOOM_ID = /^[A-Za-z0-9]{8,64}$/;

/** Convierte un share/embed de Loom en la URL canónica de compartir. */
export function canonicalLoomShareUrl(raw: string): string | null {
  const id = loomVideoId(raw);
  if (!id) return null;
  return `https://www.loom.com/share/${id}`;
}

export function loomEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = loomVideoId(raw);
  if (!id) return null;
  const params = new URLSearchParams({
    hide_owner: "true",
    hide_share: "true",
    hide_title: "true",
    hideEmbedTopBar: "true",
  });
  return `https://www.loom.com/embed/${id}?${params.toString()}`;
}

function loomVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "loom.com" && host !== "www.loom.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const kind = parts[0];
  const id = parts[1];
  if ((kind !== "share" && kind !== "embed") || !id || !LOOM_ID.test(id)) {
    return null;
  }
  return id;
}
