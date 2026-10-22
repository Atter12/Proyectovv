/**
 * Estudio de video: guion de un anuncio vertical de 15 s a partir de las fotos
 * o clips del producto (sin dependencias, para tests). El dibujo y la
 * grabación viven en video-studio-render.client.ts.
 *
 * Orden fijo: gancho → producto con beneficios → precio → llamado a la acción.
 */

export const STUDIO_DURATION = 15;
export const STUDIO_WIDTH = 720;
export const STUDIO_HEIGHT = 1280;
export const STUDIO_MAX_MEDIA = 6;
export const STUDIO_MAX_BENEFITS = 3;

const HOOK_END = 2.5;
const PRICE_SECONDS = 2.5;
const CTA_SECONDS = 2;

export type StudioTemplate = "orange" | "dark" | "fresh";
export type StudioCurrency = "PEN" | "USD" | "COP";

export type StudioInput = {
  template: StudioTemplate;
  hook: string;
  productName: string;
  benefits: string[];
  price: string;
  oldPrice: string;
  currency: StudioCurrency;
  promo: string;
  cta: string;
  storeName: string;
  /** Textos fijos que salen en el video (vienen traducidos de la UI). */
  labels?: { before: string; today: string; price: string };
};

export type StudioScene =
  | { kind: "hook"; start: number; end: number; mediaIndex: number }
  | { kind: "media"; start: number; end: number; mediaIndex: number; benefit: string | null }
  | { kind: "price"; start: number; end: number; mediaIndex: number }
  | { kind: "cta"; start: number; end: number };

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function cleanBenefits(benefits: string[]): string[] {
  return benefits.map((b) => b.trim()).filter(Boolean).slice(0, STUDIO_MAX_BENEFITS);
}

/** Escenas del video. Sin precio, el tramo de producto se alarga. */
export function buildStudioTimeline(input: {
  mediaCount: number;
  benefits: string[];
  hasPrice: boolean;
}): StudioScene[] {
  const count = Math.max(1, Math.min(STUDIO_MAX_MEDIA, Math.floor(input.mediaCount)));
  const benefits = cleanBenefits(input.benefits);
  const ctaStart = STUDIO_DURATION - CTA_SECONDS;
  const mediaEnd = input.hasPrice ? ctaStart - PRICE_SECONDS : ctaStart;

  // Al menos 3 tramos para que el video no quede quieto con una sola foto;
  // así cada beneficio también tiene su momento.
  const slots = Math.max(count, benefits.length, 3);
  const slotSeconds = (mediaEnd - HOOK_END) / slots;

  const scenes: StudioScene[] = [{ kind: "hook", start: 0, end: HOOK_END, mediaIndex: 0 }];
  for (let i = 0; i < slots; i++) {
    scenes.push({
      kind: "media",
      start: round(HOOK_END + i * slotSeconds),
      end: round(HOOK_END + (i + 1) * slotSeconds),
      // La primera foto ya salió en el gancho: el producto arranca en la siguiente.
      mediaIndex: (i + (count > 1 ? 1 : 0)) % count,
      benefit: benefits.length > 0 ? benefits[i % benefits.length] : null,
    });
  }
  if (input.hasPrice) {
    scenes.push({ kind: "price", start: mediaEnd, end: ctaStart, mediaIndex: 0 });
  }
  scenes.push({ kind: "cta", start: ctaStart, end: STUDIO_DURATION });
  return scenes;
}

export function sceneAt(scenes: StudioScene[], t: number): StudioScene {
  for (const scene of scenes) {
    if (t >= scene.start && t < scene.end) return scene;
  }
  return scenes[scenes.length - 1];
}

const CURRENCY_PREFIX: Record<StudioCurrency, string> = { PEN: "S/", USD: "$", COP: "$" };

/** "89" → "S/ 89", "89.9" → "S/ 89.90", "45000" COP → "$ 45.000". Vacío si no es número. */
export function formatStudioPrice(raw: string, currency: StudioCurrency): string {
  const n = Number(raw.replace(/[^\d.,]/g, "").replace(",", "."));
  if (!raw.trim() || !Number.isFinite(n) || n <= 0) return "";
  if (currency === "COP") {
    return `${CURRENCY_PREFIX.COP} ${Math.round(n).toLocaleString("es-CO")}`;
  }
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${CURRENCY_PREFIX[currency]} ${text}`;
}

export type StudioInputError = "noMedia" | "noProduct" | "noCta" | "oldPriceLower";

export function validateStudioInput(input: StudioInput, mediaCount: number): StudioInputError[] {
  const errors: StudioInputError[] = [];
  if (mediaCount < 1) errors.push("noMedia");
  if (!input.productName.trim()) errors.push("noProduct");
  if (!input.cta.trim()) errors.push("noCta");
  const price = Number(input.price.replace(",", "."));
  const old = Number(input.oldPrice.replace(",", "."));
  if (input.oldPrice.trim() && input.price.trim() && Number.isFinite(price) && Number.isFinite(old) && old <= price) {
    errors.push("oldPriceLower");
  }
  return errors;
}

/** Nombre de archivo seguro para el mp4. */
export function studioFileName(productName: string): string {
  const slug = productName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "producto"}-video.mp4`;
}
