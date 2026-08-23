import { resolveBmBucketFromBcId } from "@/lib/integrations/tiktok/bc-advertisers.server";

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
