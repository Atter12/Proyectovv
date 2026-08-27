import { routes } from "@/config/routes";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

/** Enlace a Gastos con rango de fechas (total agregado, sin filtros BM/campaña). */
export function buildGastosUrlForAdvertiser(input: {
  advertiserId?: string;
  bmBucket?: string | null;
  days?: number;
}): string {
  const today = todayYmdInTz();
  const days = Math.max(1, input.days ?? 7);
  const start = shiftYmd(today, -(days - 1));
  const params = new URLSearchParams({ start, end: today });
  return `${routes.gastos}?${params.toString()}`;
}
