/**
 * Lee lo que importa para un anuncio desde la página de un producto: nombre,
 * precio, precio de antes, fotos y beneficios. Sin dependencias, para tests.
 *
 * Fuentes, de más a menos confiable:
 *   1. JSON de Shopify (/products/<handle>.js), cuando la tienda es Shopify
 *   2. JSON-LD schema.org Product (casi todas las tiendas lo traen por SEO)
 *   3. Open Graph / meta product:price (WooCommerce, landings)
 *   4. <title> y meta description
 */

export type ProductInfo = {
  url: string;
  title: string;
  description: string;
  price: number | null;
  /** Precio tachado ("antes"), si la tienda lo muestra. */
  oldPrice: number | null;
  currency: string | null;
  images: string[];
  brand: string | null;
  siteName: string | null;
  /** Beneficios o características sueltas (de listas de la descripción). */
  bullets: string[];
};

export const MAX_PRODUCT_IMAGES = 6;
const MAX_DESCRIPTION = 1200;
const MAX_BULLETS = 8;

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", aacute: "á", eacute: "é", iacute: "í",
  oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  Ntilde: "Ñ", uuml: "ü", iexcl: "¡", iquest: "¿", deg: "°", reg: "®", trade: "™", copy: "©",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code] ?? match;
  });
}

/** Texto plano de un pedazo de HTML (sin scripts ni estilos). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Items de <li> de un HTML, como texto. */
export function listItems(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = htmlToText(m[1]).replace(/\s+/g, " ").trim();
    if (text.length >= 3 && text.length <= 140) out.push(text);
  }
  return out;
}

/** "S/ 1.299,90", "$129.00", "129" → número. null si no se entiende. */
export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? round2(value) : null;
  if (typeof value !== "string") return null;
  let s = value.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // El último separador es el decimal.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "1,299" (miles) o "129,90" (decimales).
    s = /,\d{3}$/.test(s) && s.indexOf(",") === lastComma ? s.replace(",", "") : s.replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) {
    // "1.299.000" o "129.900": puntos de miles (precios en pesos colombianos).
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Atributos de una etiqueta HTML ("<meta property=x content=y>"). */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}

/** meta property/name → contenidos (puede repetirse, p. ej. og:image). */
export function metaTags(html: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    if (!key || a.content === undefined) continue;
    out.set(key, [...(out.get(key) ?? []), a.content.trim()]);
  }
  return out;
}

/** Objetos JSON-LD de la página (aplana @graph y arreglos). */
export function jsonLdObjects(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    out.push(obj);
    if (obj["@graph"]) walk(obj["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1].trim()));
    } catch {
      // JSON-LD roto: se ignora, hay otras fuentes.
    }
  }
  return out;
}

function isType(obj: Record<string, unknown>, type: string): boolean {
  const t = obj["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function str(value: unknown): string {
  return typeof value === "string" ? decodeEntities(value).trim() : "";
}

function imageUrls(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageUrls);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return imageUrls(o.url ?? o.contentUrl ?? o.src);
  }
  return [];
}

/** URL absoluta (resuelve relativas y "//cdn..."); null si no es http(s) o es un ícono. */
export function absoluteImage(src: string, pageUrl: string): string | null {
  const raw = src.trim();
  if (!raw || raw.startsWith("data:")) return null;
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, pageUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (/\.(svg|ico|gif)(\?|$)/i.test(url.pathname) || /(logo|icon|favicon|sprite|placeholder)/i.test(url.pathname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function fromJsonLd(objects: Record<string, unknown>[]): Partial<ProductInfo> {
  const product = objects.find((o) => isType(o, "Product"));
  if (!product) return {};
  const offersRaw = product.offers;
  const offers = (Array.isArray(offersRaw) ? offersRaw : offersRaw ? [offersRaw] : []) as Record<string, unknown>[];
  let price: number | null = null;
  let currency: string | null = null;
  for (const offer of offers) {
    const p = parsePrice(offer.price ?? offer.lowPrice ?? (offer.priceSpecification as Record<string, unknown> | undefined)?.price);
    if (p !== null && (price === null || p < price)) {
      price = p;
      currency = str(offer.priceCurrency) || currency;
    }
  }
  const brand = product.brand;
  const description = str(product.description);
  return {
    title: str(product.name),
    description: description.includes("<") ? htmlToText(description) : description,
    price,
    currency,
    images: imageUrls(product.image),
    brand: typeof brand === "string" ? str(brand) : str((brand as Record<string, unknown> | undefined)?.name) || null,
  };
}

function first(meta: Map<string, string[]>, ...keys: string[]): string {
  for (const key of keys) {
    const v = meta.get(key)?.find((x) => x);
    if (v) return v;
  }
  return "";
}

/** Lo que se puede sacar del HTML de la página. */
export function parseProductPage(html: string, pageUrl: string): ProductInfo {
  const meta = metaTags(html);
  const ld = fromJsonLd(jsonLdObjects(html));
  const titleTag = htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const metaPrice = parsePrice(first(meta, "product:price:amount", "og:price:amount", "product:sale_price:amount"));
  const metaOld = parsePrice(first(meta, "product:original_price:amount"));
  const descriptionHtml = html.match(/<div[^>]+class=["'][^"']*(product[-_]?description|description)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[2] ?? "";

  return finalize({
    url: pageUrl,
    title: ld.title || first(meta, "og:title", "twitter:title") || titleTag,
    description: ld.description || first(meta, "og:description", "description", "twitter:description") || "",
    price: ld.price ?? metaPrice,
    oldPrice: metaOld,
    currency: ld.currency || first(meta, "product:price:currency", "og:price:currency") || null,
    images: [...(ld.images ?? []), ...(meta.get("og:image") ?? []), ...(meta.get("og:image:secure_url") ?? []), ...(meta.get("twitter:image") ?? [])],
    brand: ld.brand ?? (first(meta, "product:brand", "og:brand") || null),
    siteName: first(meta, "og:site_name") || null,
    bullets: listItems(descriptionHtml),
  });
}

/** /products/<handle> de Shopify → /products/<handle>.js (JSON público del producto). */
export function shopifyJsonUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl);
    const m = url.pathname.match(/^(.*\/products\/[^/?#.]+)\/?$/);
    if (!m) return null;
    url.pathname = `${m[1]}.js`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** El JSON de /products/<handle>.js (precios en centavos). */
export function parseShopifyProduct(json: unknown, pageUrl: string): Partial<ProductInfo> | null {
  if (!json || typeof json !== "object") return null;
  const p = json as Record<string, unknown>;
  if (typeof p.title !== "string") return null;
  const cents = (v: unknown) => (typeof v === "number" && v > 0 ? round2(v / 100) : null);
  const price = cents(p.price) ?? cents(p.price_min);
  const compare = cents(p.compare_at_price) ?? cents(p.compare_at_price_min);
  const descriptionHtml = typeof p.description === "string" ? p.description : "";
  return {
    url: pageUrl,
    title: decodeEntities(p.title).trim(),
    description: htmlToText(descriptionHtml),
    price,
    oldPrice: compare !== null && price !== null && compare > price ? compare : null,
    images: (Array.isArray(p.images) ? p.images : []).filter((x): x is string => typeof x === "string"),
    brand: typeof p.vendor === "string" && p.vendor.trim() ? p.vendor.trim() : null,
    bullets: listItems(descriptionHtml),
  };
}

/** Junta dos lecturas: lo de `primary` gana, `fallback` completa lo que falta. */
export function mergeProductInfo(primary: Partial<ProductInfo> | null, fallback: ProductInfo): ProductInfo {
  if (!primary) return fallback;
  return finalize({
    url: fallback.url,
    title: primary.title || fallback.title,
    description: primary.description || fallback.description,
    price: primary.price ?? fallback.price,
    oldPrice: primary.oldPrice ?? fallback.oldPrice,
    currency: primary.currency || fallback.currency,
    images: [...(primary.images ?? []), ...fallback.images],
    brand: primary.brand ?? fallback.brand,
    siteName: fallback.siteName,
    bullets: primary.bullets?.length ? primary.bullets : fallback.bullets,
  });
}

function finalize(info: ProductInfo): ProductInfo {
  // La misma foto suele venir de varios dominios (CDN y tienda) o en http y https.
  const byFile = new Map<string, string>();
  for (const src of info.images) {
    const abs = absoluteImage(src, info.url);
    if (!abs) continue;
    const key = new URL(abs).pathname.split("/").pop()?.toLowerCase() ?? abs;
    const prev = byFile.get(key);
    if (!prev || (prev.startsWith("http:") && abs.startsWith("https:"))) byFile.set(key, abs);
  }
  const images = [...byFile.values()];
  // "Zapatillas X | Mi Tienda" → "Zapatillas X"
  const site = info.siteName?.trim();
  let title = info.title.replace(/\s+/g, " ").trim();
  if (site && title.length > site.length + 3) title = title.replace(new RegExp(`\\s*[|\\-–—·]\\s*${escapeRegExp(site)}\\s*$`, "i"), "");
  const description = info.description.replace(/\s+\n/g, "\n").trim().slice(0, MAX_DESCRIPTION);
  const bullets = [...new Set(info.bullets.map((b) => b.replace(/\s+/g, " ").trim()))].slice(0, MAX_BULLETS);
  const oldPrice = info.oldPrice !== null && info.price !== null && info.oldPrice > info.price ? info.oldPrice : null;
  return {
    ...info,
    title: title.slice(0, 160),
    description,
    currency: info.currency ? info.currency.toUpperCase().slice(0, 3) : null,
    oldPrice,
    images: images.slice(0, MAX_PRODUCT_IMAGES),
    bullets,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ¿Hay lo mínimo para armar un anuncio? */
export function hasEnoughProductInfo(info: ProductInfo): boolean {
  return info.title.length >= 3 && (info.description.length >= 20 || info.bullets.length > 0 || info.price !== null);
}
