export const BOT_SOURCE = "support_recharge_bot";
export const RECIPIENT = Object.freeze({phone:"964290361", holder:"Holistic Marketing PE EIRL", bank:"BCP"});
export const MAX_CREDIT_USD = 100;

export function wantsRecharge(text: string): boolean {
  return /^(?:(?:hola[,!]?\s*)?(?:quiero|deseo|necesito)\s+)?(?:recargar|recarga|agregar saldo)\b/i.test(text.trim());
}

export function desiredCredit(text: string): number | null {
  if (/soles|S\//i.test(text)) return null;
  const stripped = text.trim().replace(/^(?:(?:hola[,!]?\s*)?(?:quiero|deseo|necesito)\s+)?(?:recargar|recarga|agregar saldo)\s*/i, "");
  const match = /^(?:USD\s*|US\$\s*|\$\s*)?(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*(?:USD|d[oó]lares))?$/i.exec(stripped);
  const amount = match ? Number(match[1].replace(",", ".")) : NaN;
  return Number.isFinite(amount) && amount >= 1 && amount <= MAX_CREDIT_USD ? amount : null;
}

export function paymentInstructions(total: number): string {
  return `Desde Yape, envía S/ ${(total/100).toFixed(2)} al celular ${RECIPIENT.phone}.\nSelecciona la opción ${RECIPIENT.bank} y verifica que aparezca ${RECIPIENT.holder}. Si el destinatario no coincide, no pagues y contacta a soporte.`;
}

export function verifiedProof(analysis: Record<string, unknown>, expectedCents: number): boolean {
  return analysis.analysisMode === "openai_vision" && analysis.confirmed === true && analysis.needsReview === false
    && analysis.beneficiaryMatch === true && analysis.detectedCurrency === "PEN"
    && typeof analysis.confidence === "number" && analysis.confidence >= 0.9
    && typeof analysis.detectedAmount === "number" && Math.round(analysis.detectedAmount*100) === expectedCents;
}
