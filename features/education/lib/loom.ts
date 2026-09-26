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

const DRIVE_ID = /^[A-Za-z0-9_-]{20,80}$/;

/** Loom (share o embed) o un archivo de Google Drive compartido. */
export function canonicalLessonVideoUrl(raw: string): string | null {
  return canonicalLoomShareUrl(raw) ?? canonicalDriveFileUrl(raw);
}

export function lessonEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return loomEmbedUrl(raw) ?? driveEmbedUrl(raw);
}

function canonicalDriveFileUrl(raw: string): string | null {
  const id = driveFileId(raw);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/view`;
}

function driveEmbedUrl(raw: string): string | null {
  const id = driveFileId(raw);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

function driveFileId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.hostname.toLowerCase() !== "drive.google.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.includes("folders")) return null;
  if (parts[0] === "file" && parts[1] === "d") return driveId(parts[2]);
  if (parts[0] === "open" || parts[0] === "uc") return driveId(url.searchParams.get("id"));
  return null;
}

function driveId(value: string | undefined | null): string | null {
  if (!value || !DRIVE_ID.test(value)) return null;
  return value;
}
