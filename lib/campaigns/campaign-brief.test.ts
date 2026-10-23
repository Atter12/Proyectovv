import assert from "node:assert/strict";
import test from "node:test";
import {
  BRIEF_TEXT_MAX,
  buildBriefPrompt,
  normalizeBrief,
  riskyPhrase,
  suggestDailyBudget,
} from "./campaign-brief.ts";
import type { ProductInfo } from "./product-page.ts";

const product = (over: Partial<ProductInfo> = {}): ProductInfo => ({
  url: "https://mitienda.pe/products/samba",
  title: "Zapatillas Adidas Samba OG Originales Edición Clásica",
  description: "Cuero premium y suela de goma.",
  price: 189.9,
  oldPrice: 249,
  currency: "PEN",
  images: [],
  brand: "Adidas",
  siteName: "Mi Tienda",
  bullets: ["Cuero premium", "Suela antideslizante", "Tallas 36 a 43"],
  ...over,
});
const OPTS = { country: "PE", today: "23-oct" };

test("el prompt lleva la ficha y no inventa precio", () => {
  const p = buildBriefPrompt(product(), { storeName: "Mi Tienda", country: "PE" });
  assert.match(p.user, /Precio: 189.9 PEN/);
  assert.match(p.user, /Precio antes: 249/);
  assert.match(p.user, /Características: Cuero premium · Suela antideslizante/);
  assert.match(p.system, /No inventes datos/);
  const sinPrecio = buildBriefPrompt(product({ price: null, oldPrice: null }), { country: "CO" });
  assert.match(sinPrecio.user, /Precio: no figura/);
  assert.doesNotMatch(sinPrecio.user, /Precio antes/);
});

test("limpia, corta, quita repetidos y marca frases riesgosas", () => {
  const long = "Las zapatillas que todos están buscando en Lima, con cuero premium y suela que no resbala nunca jamás";
  const brief = normalizeBrief(
    {
      texts: [
        { angle: "beneficio", text: `"${long}" #fyp` },
        { angle: "precio", text: "De S/249 a solo S/189.90 🔥" },
        { angle: "precio", text: "de s/249 a solo s/189.90 🔥" },
        { angle: "urgencia", text: "Resultados garantizados o te devolvemos tu plata" },
        { angle: "x", text: "ok" },
      ],
      hook: "¿Todavía no tienes tus Samba?",
      product_name: "Samba OG",
      benefits: ["Cuero premium"],
      cta: "Pide las tuyas hoy",
    },
    product(),
    OPTS,
  );
  assert.ok(brief);
  assert.equal(brief.texts.length, 3);
  assert.ok(brief.texts[0].text.length <= BRIEF_TEXT_MAX);
  assert.doesNotMatch(brief.texts[0].text, /["#]/);
  assert.ok(!brief.texts[0].text.endsWith(" "));
  assert.equal(brief.texts[0].risky, null);
  assert.equal(brief.texts[2].risky, "promesa absoluta");
  // Completa beneficios con la ficha.
  assert.deepEqual(brief.studio.benefits, ["Cuero premium", "Suela antideslizante", "Tallas 36 a 43"]);
  assert.equal(brief.studio.price, "189.90");
  assert.equal(brief.studio.oldPrice, "249");
  assert.equal(brief.studio.currency, "PEN");
  assert.equal(brief.campaignName, "Samba OG · 23-oct");
});

test("sin textos útiles no hay propuesta; sin nombre usa el de la ficha", () => {
  assert.equal(normalizeBrief({ texts: [] }, product(), OPTS), null);
  assert.equal(normalizeBrief("nada", product(), OPTS), null);
  const brief = normalizeBrief({ texts: ["Las Samba que todos quieren"] }, product({ currency: null }), { country: "CO", today: "1-nov" });
  assert.ok(brief);
  assert.equal(brief.studio.productName, "Zapatillas Adidas Samba OG");
  assert.equal(brief.studio.cta, "Pide el tuyo hoy");
  assert.equal(brief.studio.currency, "COP");
  assert.equal(brief.texts[0].angle, "beneficio");
});

test("frases que TikTok rechaza", () => {
  assert.equal(riskyPhrase("Quema grasa mientras duermes"), "pérdida de peso");
  assert.equal(riskyPhrase("Cura el dolor de espalda"), "promesa de salud");
  assert.equal(riskyPhrase("Un producto mágico"), "promesa milagrosa");
  assert.equal(riskyPhrase("Mira el antes y después"), "antes y después");
  assert.equal(riskyPhrase("Cómodas todo el día"), null);
});

test("presupuesto: ~3 ventas al costo por venta, entre 20 y 100", () => {
  assert.deepEqual(suggestDailyBudget(null), { amount: 20, reason: "default", costPerResult: null });
  assert.deepEqual(suggestDailyBudget(4.2), { amount: 20, reason: "cpr", costPerResult: 4.2 });
  assert.deepEqual(suggestDailyBudget(9.333), { amount: 30, reason: "cpr", costPerResult: 9.33 });
  assert.deepEqual(suggestDailyBudget(45), { amount: 100, reason: "cap", costPerResult: 45 });
  assert.equal(suggestDailyBudget(0).reason, "default");
});

test("el prompt habla como el país de la campaña y prohíbe inventar cifras", () => {
  assert.match(buildBriefPrompt(product(), { country: "PE" }).system, /zapatillas/);
  assert.match(buildBriefPrompt(product(), { country: "CO" }).system, /colombiano/);
  assert.match(buildBriefPrompt(product(), { country: "XX" }).system, /neutro/);
  assert.match(buildBriefPrompt(product(), { country: "PE" }).system, /no inventes cifras/);
});
