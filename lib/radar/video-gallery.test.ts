import assert from "node:assert/strict";
import test from "node:test";
import { summarizeVideoGallery, type VideoDayRow } from "./video-gallery.ts";

const day = (adId: string, statDate: string, over: Partial<VideoDayRow> = {}): VideoDayRow => ({
  advertiserId: "7001",
  adId,
  videoId: `v-${adId}`,
  tiktokItemId: null,
  statDate,
  adName: `VIDEO ${adId}`,
  spend: 10,
  impressions: 1000,
  clicks: 20,
  results: 5,
  videoPlayActions: 800,
  videoWatched6s: 200,
  ...over,
});

test("junta anuncios que usan el mismo video", () => {
  const out = summarizeVideoGallery([
    day("a1", "2026-10-10", { videoId: "v1" }),
    day("a2", "2026-10-10", { videoId: "v1", advertiserId: "7002", spend: 30 }),
  ]);
  assert.equal(out.videos.length, 1);
  assert.equal(out.videos[0].adsCount, 2);
  assert.equal(out.videos[0].spend, 40);
  assert.equal(out.videos[0].advertiserId, "7002");
  assert.equal(out.videos[0].topAdId, "a2");
});

test("Spark sin video se agrupa por publicación", () => {
  const out = summarizeVideoGallery([
    day("s1", "2026-10-10", { videoId: null, tiktokItemId: "765" }),
    day("s2", "2026-10-10", { videoId: null, tiktokItemId: "765" }),
  ]);
  assert.equal(out.videos.length, 1);
  assert.equal(out.videos[0].key, "post:765");
  assert.equal(out.videos[0].tiktokItemId, "765");
});

test("anuncio sin video queda aparte con su ad_id", () => {
  const out = summarizeVideoGallery([day("a1", "2026-10-10", { videoId: null })]);
  assert.equal(out.videos[0].key, "ad:a1");
  assert.equal(out.videos[0].videoId, null);
});

test("etiquetas: ganador, sin ventas y caro", () => {
  const out = summarizeVideoGallery([
    day("win", "2026-10-10", { spend: 10, results: 10 }),
    day("mid", "2026-10-10", { spend: 30, results: 10 }),
    day("bad", "2026-10-10", { spend: 30, results: 5 }),
    day("zero", "2026-10-10", { spend: 20, results: 0 }),
  ]);
  const by = new Map(out.videos.map((v) => [v.videoId, v.verdict]));
  assert.equal(by.get("v-win"), "winner");
  assert.equal(by.get("v-bad"), "expensive");
  assert.equal(by.get("v-zero"), "noResults");
  assert.equal(by.get("v-mid"), "steady");
});

test("poco gasto sin resultados no se marca como sin ventas", () => {
  const out = summarizeVideoGallery([
    day("ok", "2026-10-10", { spend: 10, results: 10 }),
    day("new", "2026-10-10", { spend: 1, results: 0 }),
  ]);
  assert.equal(out.videos.find((v) => v.videoId === "v-new")?.verdict, "steady");
});

test("cansado: el CTR de los últimos días cae fuerte", () => {
  const rows = [
    day("t", "2026-10-10", { clicks: 30, results: 1 }),
    day("t", "2026-10-11", { clicks: 30, results: 1 }),
    day("t", "2026-10-12", { clicks: 30, results: 1 }),
    day("t", "2026-10-13", { clicks: 5, results: 1 }),
    day("t", "2026-10-14", { clicks: 5, results: 1 }),
    day("t", "2026-10-15", { clicks: 5, results: 1 }),
  ];
  const out = summarizeVideoGallery(rows);
  assert.equal(out.videos[0].verdict, "tired");
  assert.equal(out.dataThrough, "2026-10-15");
});

test("ordena por gasto y respeta el límite", () => {
  const out = summarizeVideoGallery(
    [day("a", "2026-10-10", { spend: 5 }), day("b", "2026-10-10", { spend: 50 }), day("c", "2026-10-10", { spend: 20 })],
    { limit: 2 },
  );
  assert.deepEqual(out.videos.map((v) => v.videoId), ["v-b", "v-c"]);
  assert.equal(out.totals.videos, 3);
  assert.equal(out.totals.spend, 75);
});
