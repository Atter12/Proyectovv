import { routes } from "@/config/routes";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

export function buildGastosUrlForAdvertiser(input: {
  advertiserId: string;
  bmBucket?: string | null;
  /** Días hacia atrás incluyendo hoy (default 7). */
  days?: number;
}): string {
  const today = todayYmdInTz();
  const days = Math.max(1, input.days ?? 7);
  const start = shiftYmd(today, -(days - 1));
  const params = new URLSearchParams({
    advertiser: input.advertiserId.trim(),
    start,
    end: today,
  });
  const bm = input.bmBucket?.trim();
  if (bm) params.set("bm", bm.replace(/^BM\s*/i, ""));
  return `${routes.gastos}?${params.toString()}`;
}
