import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudioTimeline,
  buildVoiceoverScript,
  formatStudioPrice,
  sceneAt,
  spokenPrice,
  STUDIO_DURATION,
  studioFileName,
  validateStudioInput,
  type StudioInput,
} from "./video-studio.ts";

const input = (over: Partial<StudioInput> = {}): StudioInput => ({
  template: "orange",
  hook: "¿Todavía sin el tuyo?",
  productName: "Faja reductora",
  benefits: ["Moldea al instante"],
  price: "89",
  oldPrice: "129",
  currency: "PEN",
  promo: "Envío gratis",
  cta: "Pide ya",
  storeName: "Tienda Luna",
  ...over,
});

test("cubre los 15 s sin huecos y termina en el llamado a la acción", () => {
  const scenes = buildStudioTimeline({ mediaCount: 4, benefits: ["a", "b"], hasPrice: true });
  assert.equal(scenes[0].kind, "hook");
  assert.equal(scenes[0].start, 0);
  assert.equal(scenes.at(-1)?.kind, "cta");
  assert.equal(scenes.at(-1)?.end, STUDIO_DURATION);
  for (let i = 1; i < scenes.length; i++) assert.equal(scenes[i].start, scenes[i - 1].end);
  assert.ok(scenes.some((s) => s.kind === "price"));
});

test("sin precio no hay escena de precio y el producto dura más", () => {
  const withPrice = buildStudioTimeline({ mediaCount: 3, benefits: [], hasPrice: true });
  const without = buildStudioTimeline({ mediaCount: 3, benefits: [], hasPrice: false });
  assert.ok(!without.some((s) => s.kind === "price"));
  const len = (s: ReturnType<typeof buildStudioTimeline>) =>
    s.filter((x) => x.kind === "media").reduce((sum, x) => sum + (x.end - x.start), 0);
  assert.ok(len(without) > len(withPrice));
});

test("una sola foto se reparte en 3 tramos con los beneficios", () => {
  const scenes = buildStudioTimeline({ mediaCount: 1, benefits: ["uno", "dos", "tres"], hasPrice: true });
  const media = scenes.filter((s) => s.kind === "media");
  assert.equal(media.length, 3);
  assert.deepEqual(media.map((s) => s.kind === "media" && s.mediaIndex), [0, 0, 0]);
  assert.deepEqual(media.map((s) => s.kind === "media" && s.benefit), ["uno", "dos", "tres"]);
});

test("varias fotos: el producto arranca desde la segunda", () => {
  const scenes = buildStudioTimeline({ mediaCount: 3, benefits: [], hasPrice: false });
  const media = scenes.filter((s) => s.kind === "media");
  assert.deepEqual(media.map((s) => s.kind === "media" && s.mediaIndex), [1, 2, 0]);
});

test("sceneAt encuentra la escena y el final cae en la última", () => {
  const scenes = buildStudioTimeline({ mediaCount: 2, benefits: [], hasPrice: true });
  assert.equal(sceneAt(scenes, 0.1).kind, "hook");
  assert.equal(sceneAt(scenes, 11).kind, "price");
  assert.equal(sceneAt(scenes, STUDIO_DURATION).kind, "cta");
});

test("formato de precio por moneda", () => {
  assert.equal(formatStudioPrice("89", "PEN"), "S/ 89");
  assert.equal(formatStudioPrice("89,9", "PEN"), "S/ 89.90");
  assert.equal(formatStudioPrice("45000", "COP"), "$ 45.000");
  assert.equal(formatStudioPrice("", "USD"), "");
  assert.equal(formatStudioPrice("abc", "USD"), "");
});

test("validación: fotos, producto, llamado y precio anterior mayor", () => {
  assert.deepEqual(validateStudioInput(input(), 2), []);
  assert.deepEqual(validateStudioInput(input({ productName: " ", cta: "" }), 0), ["noMedia", "noProduct", "noCta"]);
  assert.deepEqual(validateStudioInput(input({ oldPrice: "50" }), 1), ["oldPriceLower"]);
});

test("nombre de archivo sin tildes ni espacios", () => {
  assert.equal(studioFileName("Faja Reductora Ñandú 3x"), "faja-reductora-nandu-3x-video.mp4");
  assert.equal(studioFileName("  "), "producto-video.mp4");
});

test("precio hablado por moneda", () => {
  assert.equal(spokenPrice("89", "PEN"), "89 soles");
  assert.equal(spokenPrice("89.9", "PEN"), "89 con 90 soles");
  assert.equal(spokenPrice("45000", "COP"), "45 mil pesos");
  assert.equal(spokenPrice("19.99", "USD"), "19 con 99 dólares");
  assert.equal(spokenPrice("", "PEN"), "");
});

test("guion de voz: una frase por momento y en orden", () => {
  const studio = input({ benefits: ["Moldea al instante", "Tela que respira"] });
  const scenes = buildStudioTimeline({ mediaCount: 2, benefits: studio.benefits, hasPrice: true });
  const script = buildVoiceoverScript(studio, scenes);
  assert.deepEqual(script.map((l) => l.scene), ["hook", "media", "price"]);
  assert.equal(script[1].text, "Faja reductora, moldea al instante y tela que respira.");
  assert.equal(script[2].text, "De 129 a solo 89 soles. Pide ya.");
  for (let i = 1; i < script.length; i++) assert.ok(script[i].at > script[i - 1].at);
});

test("guion sin precio ni beneficios", () => {
  const studio = input({ price: "", oldPrice: "", benefits: [] });
  const scenes = buildStudioTimeline({ mediaCount: 1, benefits: [], hasPrice: false });
  const script = buildVoiceoverScript(studio, scenes);
  assert.deepEqual(script.map((l) => l.scene), ["hook", "media", "cta"]);
  assert.equal(script[1].text, "Faja reductora.");
});
