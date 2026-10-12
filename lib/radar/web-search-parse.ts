/**
 * Búsqueda web del Radar (sin dependencias, para tests).
 *
 * En cada ronda el Radar busca en vivo videos públicos de TikTok en Google
 * (vía Serper) con los productos del cliente y su rubro. De cada resultado
 * solo se acepta un enlace de video real de tiktok.com; nunca un enlace
 * escrito por la IA. Nada se guarda.
 */

import type { RadarCategory } from "@/lib/radar/categories";

export type WebVideoRef = { videoId: string; handle: string; shareUrl: string };

/** Enlace de video de TikTok → id, autor y enlace limpio; null si no es un video. */
export function parseTikTokVideoUrl(raw: string): WebVideoRef | null {
  const match = String(raw ?? "").match(
    /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.\-]{2,40})\/video\/(\d{15,21})(?:[/?#]|$)/i,
  );
  if (!match) return null;
  const handle = match[1]!;
  const videoId = match[2]!;
  return { videoId, handle, shareUrl: `https://www.tiktok.com/@${handle}/video/${videoId}` };
}

/** Palabras del rubro para cuando el cliente aún no tiene productos. */
export const CATEGORY_QUERY_TERMS: Record<RadarCategory, string[]> = {
  HEALTH: ["suplemento natural", "remedio natural"],
  BEAUTY_AND_PERSONAL_CARE: ["skincare rutina", "maquillaje producto"],
  APPAREL_AND_ACCESSORIES: ["ropa tienda online", "outfit tienda"],
  HOME_IMPROVEMENT: ["herramientas hogar", "decoración casa producto"],
  HOUSEHOLD_PRODUCTS: ["producto limpieza hogar", "utensilios cocina"],
  FOOD_AND_BEVERAGE: ["emprendimiento comida", "bebida natural"],
  TECHNOLOGY: ["gadgets tecnología", "accesorios celular"],
  BABY_KIDS_AND_MATERNITY: ["productos bebé", "juguetes niños"],
  PETS: ["productos mascotas", "accesorios perro"],
  SPORTS_AND_OUTDOOR: ["accesorios gimnasio", "deporte producto"],
  BUSINESS_SERVICES: ["servicio negocio emprendedores", "marketing pequeños negocios"],
  EDUCATION: ["curso online", "clases virtuales"],
};

/** Ángulos de anuncio que suelen aparecer en TikTok; se rotan entre productos. */
const ANGLES = ["reseña", "cómo usar", "unboxing", "antes y después", "recomendación"];

/**
 * Consultas para Google, de lo más específico (productos del cliente) a lo
 * más amplio (rubro). Todas restringidas a videos de tiktok.com.
 */
export function buildWebQueries(input: {
  category: RadarCategory;
  products: string[];
  maxQueries: number;
}): string[] {
  const max = Math.max(1, input.maxQueries);
  const products = input.products
    .flatMap((p) => p.split(/[,;/]/))
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length >= 3)
    .filter((p, i, all) => all.indexOf(p) === i)
    .slice(0, 6);

  const terms: string[] = [];
  products.forEach((product, i) => {
    terms.push(product);
    terms.push(`${product} ${ANGLES[i % ANGLES.length]}`);
  });
  for (const term of CATEGORY_QUERY_TERMS[input.category] ?? []) terms.push(term);

  const seen = new Set<string>();
  const queries: string[] = [];
  for (const term of terms) {
    // El plan gratis de Serper no acepta rutas en site: (site:tiktok.com/@ da 400).
    const q = `site:tiktok.com ${term}`;
    if (seen.has(q)) continue;
    seen.add(q);
    queries.push(q);
    if (queries.length >= max) break;
  }
  return queries;
}

/** Texto visible de la consulta (se muestra como etiqueta del video). */
export function webSourceLabel(query: string): string {
  return query.replace(/^site:\S+\s*/i, "").trim().slice(0, 80);
}
