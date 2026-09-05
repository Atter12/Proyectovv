import { routes } from "@/config/routes";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

/** Enlace a Profit (ex Gastos) con rango de fechas. */
export function buildGastosUrlForAdvertiser(input: {
  advertiserId?: string;
  bmBucket?: string | null;
  days?: number;
}): string {
  const today = todayYmdInTz();
  const days = Math.max(1, input.days ?? 7);
  const start = shiftYmd(today, -(days - 1));
  const params = new URLSearchParams({ from: start, to: today });
  return `${routes.profit}?${params.toString()}`;
}
