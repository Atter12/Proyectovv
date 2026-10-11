import assert from "node:assert/strict";
import test from "node:test";
import { classifyOembed } from "./oembed-parse.ts";

test("un video público queda vivo con su texto y autor", () => {
  assert.deepEqual(
    classifyOembed(200, {
      html: "<blockquote class=\"tiktok-embed\"></blockquote>",
      title: "Mi rutina de mañana #salud",
      author_name: "Tienda PE",
      author_url: "https://www.tiktok.com/@tienda.pe",
      thumbnail_url: "https://p16.tiktokcdn.com/x.jpeg",
    }),
    {
      kind: "alive",
      title: "Mi rutina de mañana #salud",
      authorName: "Tienda PE",
      authorUrl: "https://www.tiktok.com/@tienda.pe",
      thumbnailUrl: "https://p16.tiktokcdn.com/x.jpeg",
    },
  );
});

test("borrado, privado o inexistente queda muerto", () => {
  assert.deepEqual(classifyOembed(400, { code: 400 }), { kind: "dead", reason: "http_400" });
  assert.deepEqual(classifyOembed(404, null), { kind: "dead", reason: "http_404" });
  assert.deepEqual(classifyOembed(200, { code: 404, message: "not found" }), { kind: "dead", reason: "code_404" });
  assert.deepEqual(classifyOembed(200, { title: "sin html" }), { kind: "dead", reason: "sin_embed" });
});

test("fallos temporales no matan el video", () => {
  assert.equal(classifyOembed(429, null).kind, "unknown");
  assert.equal(classifyOembed(503, null).kind, "unknown");
  assert.equal(classifyOembed(0, null).kind, "unknown");
  assert.equal(classifyOembed(200, "texto").kind, "unknown");
});
