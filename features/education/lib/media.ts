const POSTER_MAX_BYTES = 4 * 1024 * 1024;

export type EducationPosterKind = "jpg" | "png" | "webp" | "gif";

const KIND_TYPE: Record<EducationPosterKind, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function educationPosterKind(
  bytes: Uint8Array,
  declaredType: string,
): EducationPosterKind | null {
  if (bytes.byteLength === 0 || bytes.byteLength > POSTER_MAX_BYTES) return null;
  const kind = sniffPoster(bytes);
  if (!kind) return null;
  const declared = declaredType.trim().toLowerCase();
  if (declared && declared !== KIND_TYPE[kind]) return null;
  return kind;
}

export function educationLessonSlug(title: string, suffix: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const tail = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const stem = base || "tutorial";
  return tail ? `${stem}-${tail}` : stem;
}

function sniffPoster(bytes: Uint8Array): EducationPosterKind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}
