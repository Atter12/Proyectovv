import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTags, tagKeys } from "./tags.ts";
import { computeTaste, mergeTaste, scoreVideo, topPreferences } from "./taste.ts";
import { pickDiverseRound, pickPersonalRound, type PoolVideo } from "./rounds.ts";
import { isRadarCategory, normalizeAppearance } from "./categories.ts";

test("normalizeTags descarta dimensiones y valores desconocidos", () => {
  assert.deepEqual(
    normalizeTags({ format: "Testimonial", tone: "grito", presenter: "owner", color: "rojo" }),
    { presenter: "owner", format: "testimonial" },
  );
  assert.deepEqual(normalizeTags(null), {});
  assert.deepEqual(tagKeys({ format: "demo", pace: "fast" }), ["format:demo", "pace:fast"]);
});

test("el gusto suma me gusta, resta no me gusta y pesa más lo elegido", () => {
  const taste = computeTaste([
    { tags: { presenter: "owner", format: "testimonial" }, reaction: "like" },
    { tags: { presenter: "owner", format: "demo" }, reaction: "pick" },
    { tags: { presenter: "no_person", format: "demo" }, reaction: "dislike" },
  ]);
  assert.deepEqual(taste, {
    presenter: { owner: 2.5, no_person: -1 },
    format: { testimonial: 1, demo: 0.5 },
  });
  assert.equal(scoreVideo(taste, { presenter: "owner", format: "testimonial" }), 3.5);
  assert.equal(scoreVideo(taste, { presenter: "no_person" }), -1);
  assert.deepEqual(topPreferences(taste).map((p) => `${p.dimension}:${p.value}`), [
    "presenter:owner",
    "format:testimonial",
  ]);
});

test("recalcular desde cero no cuenta dos veces", () => {
  const items = [{ tags: { tone: "funny" as const }, reaction: "like" as const }];
  assert.deepEqual(computeTaste(items), computeTaste(items));
});

const pool: PoolVideo[] = [
  { videoId: "a", bestRank: 1, tags: { format: "testimonial", presenter: "owner", tone: "direct" } },
  { videoId: "b", bestRank: 2, tags: { format: "testimonial", presenter: "owner", tone: "direct" } },
  { videoId: "c", bestRank: 5, tags: { format: "demo", presenter: "hands_product", tone: "educational" } },
  { videoId: "d", bestRank: 3, tags: { format: "humor", presenter: "presenter", tone: "funny" } },
  { videoId: "e", bestRank: null, tags: {} },
  { videoId: "a", bestRank: 9, tags: {} },
];

test("la ronda amplia prefiere variedad antes que posición", () => {
  const { selected, reserves } = pickDiverseRound(pool, 3, new Set(), 2);
  assert.deepEqual(selected.map((v) => v.videoId), ["a", "d", "c"]);
  assert.deepEqual(reserves.map((v) => v.videoId), ["b", "e"]);
});

test("la ronda amplia excluye vistos y no repite ids", () => {
  const { selected } = pickDiverseRound(pool, 10, new Set(["a", "d"]));
  assert.deepEqual(selected.map((v) => v.videoId).sort(), ["b", "c", "e"]);
});

test("la ronda reducida sigue el gusto y limita el mismo formato", () => {
  const taste = computeTaste([{ tags: { format: "testimonial", presenter: "owner" }, reaction: "like" }]);
  const { selected } = pickPersonalRound(pool, taste, 3, new Set(), 0, 1);
  // a y b son testimonio: solo entra uno por el límite y el resto completa la ronda.
  assert.equal(selected[0]!.videoId, "a");
  assert.equal(selected.filter((v) => v.tags.format === "testimonial").length, 1);
  assert.equal(selected.length, 3);
});

test("si el límite por formato deja la ronda corta, se completa", () => {
  const sameFormat: PoolVideo[] = ["x", "y", "z"].map((id, i) => ({
    videoId: id,
    bestRank: i + 1,
    tags: { format: "demo" },
  }));
  const { selected } = pickPersonalRound(sameFormat, {}, 3, new Set(), 0, 1);
  assert.deepEqual(selected.map((v) => v.videoId), ["x", "y", "z"]);
});

test("categorías y quién puede salir en cámara se validan", () => {
  assert.equal(isRadarCategory("HEALTH"), true);
  assert.equal(isRadarCategory("ALL"), false);
  assert.deepEqual(normalizeAppearance(["owner", "x", "owner", "nobody"]), ["owner", "nobody"]);
});

test("mergeTaste suma la ronda 2 al gusto de la ronda 1", () => {
  const r1 = computeTaste([{ tags: { format: "demo", pace: "fast" }, reaction: "like" }]);
  const r2 = computeTaste([{ tags: { format: "demo" }, reaction: "pick" }]);
  assert.deepEqual(mergeTaste(r1, r2), { format: { demo: 2.5 }, pace: { fast: 1 } });
  assert.deepEqual(mergeTaste({}, {}), {});
});
