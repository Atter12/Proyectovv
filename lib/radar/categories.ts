/**
 * Rubros que el cliente puede elegir en el Radar, ligados a las categorías de
 * la Discovery API de TikTok (category_name de nivel 1). Los nombres visibles
 * viven en messages/*.json → profit.radar.categories.<valor>.
 */

export const RADAR_CATEGORIES = [
  "HEALTH",
  "BEAUTY_AND_PERSONAL_CARE",
  "APPAREL_AND_ACCESSORIES",
  "HOME_IMPROVEMENT",
  "HOUSEHOLD_PRODUCTS",
  "FOOD_AND_BEVERAGE",
  "TECHNOLOGY",
  "BABY_KIDS_AND_MATERNITY",
  "PETS",
  "SPORTS_AND_OUTDOOR",
  "BUSINESS_SERVICES",
  "EDUCATION",
] as const;

export type RadarCategory = (typeof RADAR_CATEGORIES)[number];

export function isRadarCategory(value: unknown): value is RadarCategory {
  return typeof value === "string" && (RADAR_CATEGORIES as readonly string[]).includes(value);
}

export const RADAR_OBJECTIVES = ["messages", "sales", "followers"] as const;
export type RadarObjective = (typeof RADAR_OBJECTIVES)[number];

export function isRadarObjective(value: unknown): value is RadarObjective {
  return typeof value === "string" && (RADAR_OBJECTIVES as readonly string[]).includes(value);
}

/** Quién puede salir en los videos del cliente (gusto no es lo mismo que poder producir). */
export const RADAR_APPEARANCE = ["owner", "team", "hire", "nobody"] as const;
export type RadarAppearance = (typeof RADAR_APPEARANCE)[number];

export function normalizeAppearance(raw: unknown): RadarAppearance[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((v): v is RadarAppearance =>
    typeof v === "string" && (RADAR_APPEARANCE as readonly string[]).includes(v),
  ))];
}
