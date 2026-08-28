/**
 * Conversión Holistic (centavos) → TikTok BC transfer (USD).
 * TikTok `/bc/transfer/` usa `cash_amount` en unidades de moneda (USD), no cents.
 * Verificado en prod: asignar $150 → TikTok INCREASE_BALANCE amount=150, tax=0.
 */

export function usdCentsToTikTokCashAmount(amountCents: number): number {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Monto inválido para asignar a TikTok.");
  }
  // Tope de seguridad: evita mandar por error centavos como dólares (ej. 12000 → $12,000).
  if (amountCents > 5_000_000) {
    throw new Error("Monto demasiado alto. Si necesitás más de $50,000, pedilo a soporte.");
  }

  const cashAmount = Math.round(amountCents) / 100;
  const backToCents = Math.round(cashAmount * 100);
  if (backToCents !== amountCents) {
    throw new Error("Error interno de conversión de monto. No se envió nada a TikTok.");
  }

  // 2 decimales exactos (TikTok float USD).
  return Math.round(cashAmount * 100) / 100;
}

/** Misma cifra en ambos lados: Holistic cents ↔ TikTok USD. */
export function assertTikTokCashMatchesCents(
  cashAmountUsd: number,
  amountCents: number,
): void {
  const expected = usdCentsToTikTokCashAmount(amountCents);
  if (Math.abs(cashAmountUsd - expected) > 1e-9) {
    throw new Error(
      "El monto a TikTok no coincide con la cartera Holistic. Operación cancelada.",
    );
  }
}
