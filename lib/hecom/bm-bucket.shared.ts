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

/** BMs donde Holistic puede Asignar (cash BM200 o presupuesto crédito BM10/30). */
export const SYSTEM_ALLOCATABLE_BM_BUCKETS = ["10", "30", "200"] as const;

/** @deprecated Prefer SYSTEM_ALLOCATABLE_BM_BUCKETS — BM 200 = cash transfer. */
export const SYSTEM_ALLOCATABLE_BM_BUCKET = "200";

export function parseBmBucketFromLabel(
  bmLabel: string | null | undefined,
): string | null {
  const raw = String(bmLabel ?? "").trim();
  if (!raw) return null;
  const labeled = raw.match(/\bBM\s*(\d{1,3})\b/i);
  if (labeled) return labeled[1];
  if (/^\d{1,3}$/.test(raw)) return raw;
  return null;
}

/** Cuentas BM 10 / 30 / 200 se pueden asignar desde Holistic (vía cash o presupuesto). */
export function isSystemAllocatableBmLabel(
  bmLabel: string | null | undefined,
): boolean {
  const bucket = parseBmBucketFromLabel(bmLabel);
  return (
    bucket != null &&
    (SYSTEM_ALLOCATABLE_BM_BUCKETS as readonly string[]).includes(bucket)
  );
}

/** BM 10/30: crédito SHARED → Asignar sube presupuesto (no cash transfer). */
export function isSharedCreditBmBucket(
  bmBucket: string | null | undefined,
): boolean {
  const b = String(bmBucket ?? "").trim();
  return b === "10" || b === "30";
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
