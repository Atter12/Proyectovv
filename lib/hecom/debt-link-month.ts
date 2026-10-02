/** Suma o resta meses a `YYYY-MM` sin depender de la zona horaria. */
export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/**
 * Mes que abre un link de deuda cuando no trae `?m=`.
 * Es el mes cerrado anterior. No baja del primer mes visible.
 */
export function defaultDebtLinkMonth(nowYm: string, fromMonth: string): string {
  const prev = shiftYm(nowYm, -1);
  return prev < fromMonth ? fromMonth : prev;
}

/** `?m=` válido manda. Si no viene, abre el mes anterior. */
export function resolvePublicDebtLinkMonth(
  query: string | undefined,
  nowYm: string,
  fromMonth: string,
): string {
  if (query && /^\d{4}-\d{2}$/.test(query) && query >= fromMonth && query <= nowYm) {
    return query;
  }
  return defaultDebtLinkMonth(nowYm, fromMonth);
}
