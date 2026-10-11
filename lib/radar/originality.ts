/**
 * Filtro anti-copia de las recetas (sin dependencias, para tests).
 *
 * "Receta, no copia": un guion generado no puede repetir frases de los videos
 * que el cliente tomó como referencia. Se mide con trigramas de palabras
 * (qué parte del guion ya aparece en un texto de origen) y con la racha más
 * larga de palabras seguidas en común.
 */

const STOPWORDS = new Set([
  "a", "al", "con", "de", "del", "el", "en", "es", "la", "las", "lo", "los", "mi", "mis", "no",
  "o", "para", "por", "que", "se", "si", "su", "sus", "te", "tu", "tus", "un", "una", "y", "ya",
]);

export function tokenize(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@][\p{L}\p{N}_.]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ngrams(tokens: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i += 1) {
    const gram = tokens.slice(i, i + n);
    // Un trigrama hecho solo de palabras vacías ("de la que") no prueba copia.
    if (gram.every((t) => STOPWORDS.has(t))) continue;
    out.add(gram.join(" "));
  }
  return out;
}

/** Qué fracción de los trigramas del candidato aparece en el origen (0–1). */
export function containment(candidate: string, source: string, n = 3): number {
  const a = ngrams(tokenize(candidate), n);
  if (a.size === 0) return 0;
  const b = ngrams(tokenize(source), n);
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return shared / a.size;
}

/** Largo de la racha más larga de palabras seguidas que comparten ambos textos. */
export function longestSharedRun(candidate: string, source: string): number {
  const a = tokenize(candidate);
  const b = tokenize(source);
  if (a.length === 0 || b.length === 0) return 0;
  let best = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const row = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev[j - 1]! + 1;
        if (row[j]! > best) best = row[j]!;
      }
    }
    prev = row;
  }
  return best;
}

export type OriginalityResult = {
  ok: boolean;
  /** Peor caso encontrado entre todos los textos de origen. */
  maxContainment: number;
  maxRun: number;
  /** Índice del texto de origen más parecido, o -1. */
  closestSource: number;
};

export const ORIGINALITY_LIMITS = { maxContainment: 0.2, maxRun: 6 } as const;

export function checkOriginality(
  candidate: string,
  sources: string[],
  limits: { maxContainment: number; maxRun: number } = ORIGINALITY_LIMITS,
): OriginalityResult {
  let maxContainment = 0;
  let maxRun = 0;
  let closestSource = -1;
  sources.forEach((source, index) => {
    if (!source) return;
    const c = containment(candidate, source);
    const r = longestSharedRun(candidate, source);
    if (c > maxContainment || r > maxRun) closestSource = index;
    maxContainment = Math.max(maxContainment, c);
    maxRun = Math.max(maxRun, r);
  });
  return {
    ok: maxContainment <= limits.maxContainment && maxRun < limits.maxRun,
    maxContainment: Math.round(maxContainment * 1000) / 1000,
    maxRun,
    closestSource,
  };
}
