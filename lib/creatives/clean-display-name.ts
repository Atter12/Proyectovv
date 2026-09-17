/** Nombre legible para cliente a partir de filenames TikTok / Smart+. */
export function cleanCreativeDisplayName(raw: string | null | undefined): string {
  const input = String(raw ?? "").trim();
  if (!input) return "Video";

  // "VIDEO 1_xxxxx.mp4_VIDEO 1" → "VIDEO 1"
  const videoDup = input.match(/^(VIDEO\s*\d+(?:\s*\d+)?)/i);
  if (videoDup && /_VIDEO\s*\d+/i.test(input)) {
    return videoDup[1].replace(/\s+/g, " ").trim().toUpperCase();
  }

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

  // Fallback: first readable chunk
  const chunk = beforeExt.split("_")[0]?.trim();
  if (chunk && chunk.length <= 32) return chunk;
  return input.slice(0, 40);
}
