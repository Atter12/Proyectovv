import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWebQueries, parseTikTokVideoUrl, webSourceId, webSourceLabel } from "./web-search-parse.ts";

test("acepta enlaces de video de TikTok y los limpia", () => {
  assert.deepEqual(
    parseTikTokVideoUrl("https://www.tiktok.com/@perez.farmaceuticos/video/7479073749120158998?lang=en"),
    {
      videoId: "7479073749120158998",
      handle: "perez.farmaceuticos",
      shareUrl: "https://www.tiktok.com/@perez.farmaceuticos/video/7479073749120158998",
    },
  );
  assert.equal(parseTikTokVideoUrl("https://m.tiktok.com/@a_b/video/7324122317158714630")?.videoId, "7324122317158714630");
});

test("rechaza lo que no es un video", () => {
  assert.equal(parseTikTokVideoUrl("https://www.tiktok.com/discover/aceite-de-oregano"), null);
  assert.equal(parseTikTokVideoUrl("https://shop.tiktok.com/us/pdp/teclado/1731230805799768269"), null);
  assert.equal(parseTikTokVideoUrl("https://www.tiktok.com/@tienda"), null);
  assert.equal(parseTikTokVideoUrl("https://evil.com/?u=https://www.tiktok.com/@x/video/7324122317158714630"), null);
});

test("las consultas empiezan por los productos y terminan en el rubro", () => {
  const q = buildWebQueries({
    category: "TECHNOLOGY",
    products: ["PROCESADORES, TECLADOS, MOUSE"],
    maxQueries: 20,
  });
  assert.equal(q[0], "site:tiktok.com procesadores");
  assert.ok(q.includes("site:tiktok.com teclados"));
  assert.ok(q.some((x) => x.startsWith("site:tiktok.com mouse ")));
  assert.equal(q.at(-1), "site:tiktok.com accesorios celular");
  assert.equal(new Set(q).size, q.length);
});

test("sin productos usa el rubro y respeta el máximo", () => {
  const q = buildWebQueries({ category: "HEALTH", products: [], maxQueries: 1 });
  assert.deepEqual(q, ["site:tiktok.com suplemento natural"]);
});

test("id y etiqueta de la fuente", () => {
  assert.equal(webSourceId("site:tiktok.com teclados reseña"), "web:teclados-resena");
  assert.equal(webSourceLabel("site:tiktok.com teclados reseña"), "teclados reseña");
});
