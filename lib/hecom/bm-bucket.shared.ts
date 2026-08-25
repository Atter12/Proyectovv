/** Mapa BM Hecom → BC ID TikTok (compartido server + client). */
export const HECOM_BM_BUCKET_TO_BC: Record<string, string> = {
  "200": "7575005779271614480",
  "30": "7564426417577148433",
  "10": "7652451146933698576",
};

/** BC ID TikTok → bm_bucket Hecom ("10" | "30" | "200"). */
export function resolveBmBucketFromBcId(
  bcId: string | null | undefined,
): string | null {
  const id = String(bcId ?? "").trim();
  if (!id) return null;
  for (const [bucket, mapped] of Object.entries(HECOM_BM_BUCKET_TO_BC)) {
    if (mapped === id) return bucket;
  }
  return null;
}

/** Etiquetas cortas de BM para UI (Cuentas ads, Pagos). */
export function formatBmBucketLabel(
  bmBucket: string | null | undefined,
  bcId?: string | null,
): string | null {
  const bucket = String(bmBucket ?? "").trim();
  if (bucket && /^\d{1,3}$/.test(bucket)) return `BM ${bucket}`;
  const fromBc = resolveBmBucketFromBcId(bcId);
  if (fromBc) return `BM ${fromBc}`;
  return null;
}
