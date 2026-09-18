/** Shared constants for “cobro faltante” claims (Lo pagado → Hecom). */
export const MISSING_COBRO_PURPOSE = "hecom_missing_cobro";
export const MISSING_COBRO_SOURCE = "lo_pagado_missing_cobro";
/** Max open (awaiting proof / pending review) claims per Hecom cliente. */
export const MISSING_COBRO_MAX_PENDING = 3;

export function isMissingCobroPurpose(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return String(metadata.purpose ?? "").trim() === MISSING_COBRO_PURPOSE;
}

export function missingCobroCodigo(paymentIntentId: string): string {
  return `C-MISS-${paymentIntentId}`;
}

/** YYYY-MM from client input. */
export function normalizePeriodoResumen(raw: string): string | null {
  const m = String(raw ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}`;
}

/** Last N calendar months including current (America/Lima-ish via UTC date is fine for picker). */
export function listRecentPeriodos(count = 6): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
  }
  return out;
}
