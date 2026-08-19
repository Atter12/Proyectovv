/**
 * Match Hecom cliente ↔ nombre advertiser TikTok (fallback).
 * Fuente de verdad operativa: advertiser_id en Hecom.
 */

export function normalizeAdvertiserName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Ej. cliente "Adriana" ↔ "Adriana 200 USD".
 * Tokens cortos (<3) se ignoran; primer token ≥5 permite soft match.
 */
export function advertiserMatchesCliente(
  advertiserName: string,
  clienteName: string,
): boolean {
  const adv = normalizeAdvertiserName(advertiserName);
  const client = normalizeAdvertiserName(clienteName);
  if (!adv || !client || client.length < 4) return false;
  if (adv === client || adv.startsWith(`${client} `) || adv.startsWith(client)) {
    return true;
  }
  const tokens = client.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  if (tokens.every((token) => adv.includes(token))) return true;

  const first = tokens[0];
  if (first && first.length >= 5) {
    const advTokens = new Set(adv.split(" ").filter(Boolean));
    if (adv.startsWith(first) || advTokens.has(first)) return true;
  }
  return false;
}
