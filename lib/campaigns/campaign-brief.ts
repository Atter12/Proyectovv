/**
 * "Asistente de campañas": con lo leído de la página del producto, la IA
 * propone textos de anuncio y el guion de "Crear video"; el presupuesto lo
 * calcula esta regla (no la IA) con lo que le cuesta una venta al cliente.
 * Sin dependencias de valores, para tests.
 */
import type { ProductInfo } from "./product-page";

export const BRIEF_TEXTS = 5;
/** TikTok corta el texto del anuncio en 100; se pide menos para que entre completo. */
export const BRIEF_TEXT_MAX = 90;
const HOOK_MAX = 48;
const PRODUCT_NAME_MAX = 32;
const BENEFIT_MAX = 30;
const CTA_MAX = 20;
/** Igual que MIN_DAILY_BUDGET de smart-plus-plan (mínimo de TikTok para Smart+). */
export const BRIEF_MIN_BUDGET = 20;
const BRIEF_MAX_BUDGET = 100;

export type CampaignBrief = {
  /** Textos del anuncio, distintos ángulos (beneficio, precio, urgencia...). */
  texts: { text: string; angle: string; risky: string | null }[];
  /** Guion para "Crear video". */
  studio: {
    hook: string;
    productName: string;
    benefits: string[];
    price: string;
    oldPrice: string;
    currency: "PEN" | "USD" | "COP";
    cta: string;
  };
  campaignName: string;
};

export type BudgetSuggestion = {
  amount: number;
  /** cpr: según su costo por venta · default: sin historial · cap: tope de prueba. */
  reason: "cpr" | "default" | "cap";
  costPerResult: number | null;
};

/**
 * Frases que TikTok suele rechazar en anuncios (promesas absolutas, salud,
 * dinero fácil, antes/después). Si un texto las tiene, se marca para que la
 * persona lo cambie: no se borra, la decisión es suya.
 */
const RISKY: [RegExp, string][] = [
  [/\b(garantizad[oa]s?|100\s?%|cero riesgo|sin riesgo)\b/i, "promesa absoluta"],
  [/\b(cura[rns]?|sana|elimina (el|la|los|las) (dolor|grasa|celulitis|acn[eé]|diabetes))\b/i, "promesa de salud"],
  [/\b(baja[rs]? de peso|adelgaza|pierde \d+\s?kg|quema grasa)\b/i, "pérdida de peso"],
  [/\b(milagr\w*|m[aá]gic[oa])\b/i, "promesa milagrosa"],
  [/\b(gana dinero|dinero f[aá]cil|hazte rico|ingresos pasivos)\b/i, "dinero fácil"],
  [/\b(antes y despu[eé]s)\b/i, "antes y después"],
  [/\b(el mejor del mundo|n[uú]mero 1 del mundo|[uú]nico en el mundo)\b/i, "superlativo sin prueba"],
];

export function riskyPhrase(text: string): string | null {
  for (const [re, label] of RISKY) if (re.test(text)) return label;
  return null;
}

const ANGLES = ["beneficio", "problema", "precio", "urgencia", "prueba social"] as const;

/** Mensajes para la IA (system + user). La respuesta tiene que ser el JSON de BRIEF_JSON_SCHEMA. */
/** Cómo habla la gente del país de la campaña (palabras que cambian entre países). */
const VOICE_BY_COUNTRY: Record<string, string> = {
  PE: "español peruano (se dice zapatillas, polo, casaca, celular, chévere)",
  CO: "español colombiano (se dice tenis, camiseta, chaqueta, celular, chévere)",
  MX: "español mexicano (se dice tenis, playera, chamarra, celular)",
  EC: "español ecuatoriano (se dice zapatos deportivos, camiseta, chompa, celular)",
  CL: "español chileno (se dice zapatillas, polera, chaqueta, celular)",
  BO: "español boliviano (se dice zapatillas, polera, chamarra, celular)",
  DO: "español dominicano (se dice tenis, t-shirt, abrigo, celular)",
};

export function buildBriefPrompt(product: ProductInfo, opts: { storeName?: string | null; country: string }): { system: string; user: string } {
  const voice = VOICE_BY_COUNTRY[opts.country] ?? "español latinoamericano neutro";
  const system = [
    "Eres un copywriter experto en anuncios de TikTok para tiendas online de Latinoamérica que venden contra entrega.",
    `Escribes en ${voice}: natural, cercano y directo, como habla un creador de TikTok, sin sonar a publicidad de radio.`,
    "Si la ficha está en otro idioma, tradúcela: todo va en español.",
    "Reglas de TikTok Ads: nada de promesas absolutas (garantizado, 100%), nada de curas ni pérdida de peso, nada de 'antes y después', nada de dinero fácil.",
    "No inventes datos: usa solo lo que dice la ficha del producto. Si no hay precio, no lo menciones.",
    "En prueba social no inventes cifras ni clientes ('miles ya lo usan'): habla de la experiencia de usarlo.",
    "En urgencia no inventes stock limitado ni plazos: invita a pedir hoy.",
    "Máximo 1 emoji por texto. Sin hashtags. Sin comillas.",
    "Responde solo con el JSON pedido.",
  ].join(" ");
  const lines = [
    `País de la campaña: ${opts.country}.`,
    opts.storeName ? `Tienda: ${opts.storeName}.` : "",
    `Producto: ${product.title}`,
    product.brand ? `Marca: ${product.brand}` : "",
    product.price !== null ? `Precio: ${product.price}${product.currency ? ` ${product.currency}` : ""}` : "Precio: no figura",
    product.oldPrice !== null ? `Precio antes: ${product.oldPrice}` : "",
    product.description ? `Descripción: ${product.description.slice(0, 900)}` : "",
    product.bullets.length ? `Características: ${product.bullets.join(" · ")}` : "",
    "",
    `Escribe ${BRIEF_TEXTS} textos de anuncio de máximo ${BRIEF_TEXT_MAX} caracteres, uno por ángulo: ${ANGLES.join(", ")}.`,
    `Y el guion de un video corto: hook (máximo ${HOOK_MAX} caracteres, para los 2 primeros segundos), nombre corto del producto (máximo ${PRODUCT_NAME_MAX}),`,
    `3 beneficios concretos (máximo ${BENEFIT_MAX} caracteres cada uno) y un llamado a la acción (máximo ${CTA_MAX}, por ejemplo "Pide el tuyo hoy").`,
  ];
  return { system, user: lines.filter((l) => l !== "").join("\n") };
}

/** Esquema de la respuesta para la salida estructurada de OpenAI. */
export const BRIEF_JSON_SCHEMA = {
  name: "campaign_brief",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["texts", "hook", "product_name", "benefits", "cta"],
    properties: {
      texts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["angle", "text"],
          properties: { angle: { type: "string" }, text: { type: "string" } },
        },
      },
      hook: { type: "string" },
      product_name: { type: "string" },
      benefits: { type: "array", items: { type: "string" } },
      cta: { type: "string" },
    },
  },
} as const;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const s = value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").replace(/^["'“”«]+|["'“”»]+$/g, "").replace(/#\w+/g, "").trim();
  if (s.length <= max) return s;
  // Cortar en la última palabra completa.
  const cut = s.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : s.slice(0, max)).replace(/[\s,;:.-]+$/, "");
}

function studioCurrency(currency: string | null, country: string): CampaignBrief["studio"]["currency"] {
  const c = (currency ?? "").toUpperCase();
  if (c === "PEN" || c === "USD" || c === "COP") return c;
  return country === "CO" ? "COP" : country === "PE" ? "PEN" : "USD";
}

function priceText(n: number | null): string {
  return n === null ? "" : Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Respuesta de la IA → propuesta lista para la pantalla. Limpia largos,
 * comillas y hashtags, quita repetidos, marca frases riesgosas y completa con
 * datos de la ficha lo que la IA no devolvió.
 */
export function normalizeBrief(
  raw: unknown,
  product: ProductInfo,
  opts: { country: string; today: string },
): CampaignBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const texts: CampaignBrief["texts"] = [];
  for (const item of Array.isArray(r.texts) ? r.texts : []) {
    const obj = (item ?? {}) as Record<string, unknown>;
    const text = clean(obj.text ?? item, BRIEF_TEXT_MAX);
    const key = text.toLowerCase();
    if (text.length < 8 || seen.has(key)) continue;
    seen.add(key);
    texts.push({ text, angle: clean(obj.angle, 20) || ANGLES[texts.length % ANGLES.length], risky: riskyPhrase(text) });
    if (texts.length === BRIEF_TEXTS) break;
  }
  if (texts.length === 0) return null;

  const productName = clean(r.product_name, PRODUCT_NAME_MAX) || clean(product.title, PRODUCT_NAME_MAX);
  const benefits = (Array.isArray(r.benefits) ? r.benefits : [])
    .map((b) => clean(b, BENEFIT_MAX))
    .filter(Boolean);
  for (const bullet of product.bullets) {
    if (benefits.length >= 3) break;
    const b = clean(bullet, BENEFIT_MAX);
    if (b && !benefits.includes(b)) benefits.push(b);
  }
  while (benefits.length < 3) benefits.push("");

  return {
    texts,
    studio: {
      hook: clean(r.hook, HOOK_MAX),
      productName,
      benefits: benefits.slice(0, 3),
      price: priceText(product.price),
      oldPrice: priceText(product.oldPrice),
      currency: studioCurrency(product.currency, opts.country),
      cta: clean(r.cta, CTA_MAX) || "Pide el tuyo hoy",
    },
    campaignName: `${productName || "Producto"} · ${opts.today}`.slice(0, 100),
  };
}

/**
 * Presupuesto diario para empezar. Smart+ necesita varias ventas al día para
 * aprender, así que se apunta a ~3 ventas al costo por venta que ya tiene el
 * cliente, redondeado a 5, entre el mínimo de TikTok y un tope de prueba.
 * Sin historial: el mínimo.
 */
export function suggestDailyBudget(costPerResult: number | null): BudgetSuggestion {
  if (costPerResult === null || !Number.isFinite(costPerResult) || costPerResult <= 0) {
    return { amount: BRIEF_MIN_BUDGET, reason: "default", costPerResult: null };
  }
  const target = Math.ceil((costPerResult * 3) / 5) * 5;
  const amount = Math.min(BRIEF_MAX_BUDGET, Math.max(BRIEF_MIN_BUDGET, target));
  return {
    amount,
    reason: target > BRIEF_MAX_BUDGET ? "cap" : "cpr",
    costPerResult: Math.round(costPerResult * 100) / 100,
  };
}
