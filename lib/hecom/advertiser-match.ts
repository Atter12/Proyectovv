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

/** Distancia Levenshtein; tolera 1 typo en tokens largos (Rodrigez ↔ Rodriguez). */
function tokenFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let mismatches = 0;
  const maxLen = Math.max(a.length, b.length);
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) mismatches++;
    if (mismatches > 1) return false;
  }
  return mismatches + (maxLen - minLen) <= 1;
}

function tokensMatch(clientTokens: string[], adv: string): boolean {
  const advTokens = adv.split(" ").filter(Boolean);
  const advSet = new Set(advTokens);
  return clientTokens.every(
    (token) =>
      adv.includes(token) ||
      advTokens.some((advToken) => tokenFuzzyMatch(token, advToken)) ||
      (token.length >= 5 && advSet.has(token)),
  );
}

/**
 * Ej. cliente "Adriana" ↔ "Adriana 200 USD".
 * "Jhosdan Rodrigez Calderon" ↔ "Jhosdan Rodriguez 200 USD".
 * Con nombre+apellido exige ambos tokens (evita Adriano↔Adriana).
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

  // Nombre + apellido (o más): todos los tokens deben aparecer.
  if (tokens.length >= 2) {
    return tokensMatch(tokens, adv);
  }

  // Un solo token de cliente: prefijo / fuzzy.
  const first = tokens[0];
  if (first && first.length >= 5) {
    const advTokens = adv.split(" ").filter(Boolean);
    if (
      adv.startsWith(first) ||
      advTokens.some((t) => tokenFuzzyMatch(first, t))
    ) {
      return true;
    }
  }
  return tokensMatch(tokens, adv);
}
