/** Nombre legible para cliente a partir de filenames TikTok / Smart+. */
export function cleanCreativeDisplayName(raw: string | null | undefined): string {
  const input = String(raw ?? "").trim();
  if (!input) return "Video";

  // "VIDEO 1_xxxxx.mp4_VIDEO 1" / "VIDEO 3 3" → "Video 1" / "Video 3"
  const videoNum = input.match(/VIDEO\s*(\d+)/i);
  if (videoNum) return `Video ${videoNum[1]}`;

  // "12_9p6HJ2yB.mp4_3" → "Video 12"
  const leadingNum = input.match(/^(\d+)_[A-Za-z0-9]+\.(mp4|mov|avi|webm)_/i);
  if (leadingNum) return `Video ${leadingNum[1]}`;

  // "aire5_tIqNupJh.mov_Nombre..." → take before hash-like segment
  const beforeExt = input.split(/[\\/]/).pop() ?? input;
  const noHash = beforeExt
    .replace(/_[A-Za-z0-9]{6,}\.(mp4|mov|avi|webm).*$/i, "")
    .replace(/\.(mp4|mov|avi|webm).*$/i, "")
    .replace(/_/g, " ")
    .trim();

  if (noHash && noHash.length >= 2 && noHash.length <= 48) {
    return noHash.replace(/\s+/g, " ");
  }

  const chunk = beforeExt.split("_")[0]?.trim();
  if (chunk && chunk.length <= 32) return chunk;
  return input.slice(0, 40);
}
