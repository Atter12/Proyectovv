/**
 * Al aprobar un comprobante manual, soporte escribe el monto BRUTO que llegó y el
 * sistema descuenta el fee. Si escribe el monto ya sin fee, el fee se cobra dos veces
 * (Julio Lirio, 17/10/2026: llegaron 733.50 USDT, se aprobó 698.57 = 733.50 / 1.05 y
 * la cartera recibió 665.30 en vez de 698.57).
 *
 * Devuelve el monto de referencia (esperado u OCR) del que parece haberse restado el
 * fee, o null si el monto escrito no tiene esa forma.
 */
export function detectAmountEnteredWithoutFee(input: {
  enteredCents: number;
  referenceCents: Array<number | null | undefined>;
  feePercent: number;
}): number | null {
  const { enteredCents, feePercent } = input;
  if (!Number.isFinite(enteredCents) || enteredCents <= 0) return null;
  if (!Number.isFinite(feePercent) || feePercent <= 0) return null;
  // Si coincide con algún monto de referencia (ej. lo que leyó el OCR), es lo que llegó:
  // un voucher de 1000 con pedido de 1100 y fee 10% no es error.
  if (input.referenceCents.some((ref) => ref != null && Math.abs(ref - enteredCents) <= 2)) {
    return null;
  }
  for (const ref of input.referenceCents) {
    if (ref == null || !Number.isFinite(ref) || ref <= 0) continue;
    const net = Math.round(ref / (1 + feePercent / 100));
    if (Math.abs(enteredCents - net) <= 2 && ref - enteredCents >= 50) return ref;
  }
  return null;
}
