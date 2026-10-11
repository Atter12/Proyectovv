import assert from "node:assert/strict";
import test from "node:test";
import { checkOriginality, containment, longestSharedRun, tokenize } from "./originality.ts";
import { categoryBenchmark, percentile, type BenchmarkRow } from "./benchmarks.ts";
import { parseRecipe, parseScripts, scriptText } from "./recipe-parse.ts";

test("tokenize quita tildes, hashtags, menciones y enlaces", () => {
  assert.deepEqual(tokenize("¡Mi RUTINA de mañana! #salud @tienda.pe https://x.co/a"), ["mi", "rutina", "de", "manana"]);
});

test("una frase copiada se detecta aunque cambien mayúsculas y signos", () => {
  const source = "Mi rutina para la glucosa en 3 pasos, sin dietas raras #salud";
  const copy = "MI RUTINA PARA LA GLUCOSA en 3 pasos! Pruébalo hoy";
  assert.ok(containment(copy, source) > 0.5);
  assert.ok(longestSharedRun(copy, source) >= 6);
  assert.equal(checkOriginality(copy, ["otra cosa", source]).ok, false);
  assert.equal(checkOriginality(copy, ["otra cosa", source]).closestSource, 1);
});

test("un guion propio con el mismo patrón pasa", () => {
  const source = "Mi rutina para la glucosa en 3 pasos, sin dietas raras";
  const own = "¿Te cuesta mantener tu azúcar estable? Así arranco el día con Glucora: agua tibia, desayuno y una cápsula.";
  const result = checkOriginality(own, [source]);
  assert.equal(result.ok, true);
  assert.ok(result.maxRun < 6);
});

test("palabras vacías en común no cuentan como copia", () => {
  assert.equal(containment("de la que en el", "de la que en el mercado"), 0);
});

const rows = (cliente: string, adv: string, spend: number, results: number): BenchmarkRow => ({
  advertiserId: adv,
  hecomClienteId: cliente,
  spend,
  results,
  impressions: 1000,
  clicks: 20,
  videoPlayActions: 900,
  videoWatched6s: 300,
});

test("con menos de 5 clientes distintos no hay referencia", () => {
  const four = ["a", "b", "c", "d"].map((c, i) => rows(c, `adv${i}`, 50, 10));
  assert.equal(categoryBenchmark(four), null);
  // Cinco cuentas de un mismo cliente tampoco anonimizan.
  const sameCliente = [0, 1, 2, 3, 4].map((i) => rows("a", `adv${i}`, 50, 10));
  assert.equal(categoryBenchmark(sameCliente), null);
});

test("con 5 clientes devuelve rangos por cuenta, no por anuncio", () => {
  const data = [
    rows("a", "1", 10, 10),
    rows("a", "1", 10, 10), // segundo anuncio de la misma cuenta: se suma
    rows("b", "2", 30, 10),
    rows("c", "3", 40, 10),
    rows("d", "4", 50, 10),
    rows("e", "5", 60, 10),
  ];
  const bench = categoryBenchmark(data)!;
  assert.equal(bench.accounts, 5);
  assert.deepEqual(bench.costPerResult, { p25: 3, p50: 4, p75: 5 });
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
});

test("parseRecipe exige resumen, gancho y estructura", () => {
  assert.equal(parseRecipe({ summary: "x" }), null);
  const recipe = parseRecipe({
    summary: "Testimonio corto de la dueña",
    hook: { type: "precio", example: "¿S/ 39 por esto?", why: "El precio frena el scroll" },
    format: "Testimonio",
    durationSeconds: "15",
    structure: [{ seconds: 3, beat: "Gancho con precio" }, { seconds: "3-10s", beat: "Uso real" }, { beat: "" }],
    onScreenText: ["S/ 39", 4],
    cta: "Escríbenos por WhatsApp",
    why: ["Funciona en el rubro"],
  })!;
  assert.equal(recipe.durationSeconds, 15);
  assert.deepEqual(recipe.structure, [
    { seconds: "3s", beat: "Gancho con precio" },
    { seconds: "3-10s", beat: "Uso real" },
  ]);
  assert.deepEqual(recipe.onScreenText, ["S/ 39"]);
  assert.deepEqual(recipe.avoid, []);
});

test("parseScripts descarta guiones incompletos y corta en 3", () => {
  const good = { title: "Mañana real", hook: "¿Tu azúcar sube?", beats: [{ seconds: "0-3s", shot: "Primer plano", line: "Hola" }], cta: "Escríbeme" };
  const scripts = parseScripts([good, { title: "sin beats", hook: "x", beats: [] }, good, good, good]);
  assert.equal(scripts.length, 3);
  assert.match(scriptText(scripts[0]!), /azúcar sube.*Hola.*Escríbeme/);
});
