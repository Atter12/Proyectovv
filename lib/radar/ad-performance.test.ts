import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAdPerformance, type AdDayRow } from "./ad-performance.ts";

const day = (adId: string, statDate: string, over: Partial<AdDayRow> = {}): AdDayRow => ({
  advertiserId: "7001",
  adId,
  statDate,
  adName: `VIDEO ${adId}`,
  campaignName: "TESTEO/GLUCORA/WEB",
  spend: 10,
  impressions: 1000,
  clicks: 20,
  results: 5,
  videoPlayActions: 800,
  videoWatched2s: 400,
  videoWatched6s: 200,
  ...over,
});

test("suma los días por anuncio y recalcula las tasas desde los totales", () => {
  const { ads, totals, dataThrough } = summarizeAdPerformance([
    day("a", "2026-10-08"),
    day("a", "2026-10-09", { spend: 30, impressions: 3000, clicks: 30, results: 5, videoPlayActions: 200, videoWatched2s: 100, videoWatched6s: 20 }),
    day("b", "2026-10-09", { spend: 5, results: 0 }),
  ]);
  const a = ads[0]!;
  assert.equal(a.adId, "a");
  assert.equal(a.spend, 40);
  assert.equal(a.ctr, 1.25); // 50 clics / 4000 impresiones, no el promedio de 2% y 1%
  assert.equal(a.costPerResult, 4);
  assert.equal(a.hold2s, 0.5);
  assert.equal(a.hold6s, 0.22);
  assert.equal(a.daysActive, 2);
  assert.equal(a.lastDate, "2026-10-09");
  assert.equal(totals.spend, 45);
  assert.equal(totals.costPerResult, 4.5);
  assert.equal(dataThrough, "2026-10-09");
});

test("compara el costo por resultado de cada anuncio con el del cliente", () => {
  const { ads } = summarizeAdPerformance([
    day("barato", "2026-10-09", { spend: 10, results: 10 }),
    day("caro", "2026-10-09", { spend: 30, results: 10 }),
  ]);
  // Promedio del cliente: 40 / 20 = 2.
  assert.deepEqual(
    ads.map((a) => [a.adId, a.costPerResult, a.vsAverage]),
    [
      ["caro", 3, 1.5],
      ["barato", 1, 0.5],
    ],
  );
});

test("sin resultados no inventa costo ni comparación", () => {
  const { ads, totals } = summarizeAdPerformance([day("x", "2026-10-09", { results: 0, videoPlayActions: 0 })]);
  assert.equal(ads[0]!.costPerResult, null);
  assert.equal(ads[0]!.vsAverage, null);
  assert.equal(ads[0]!.hold6s, null);
  assert.equal(totals.costPerResult, null);
});

test("el nombre más reciente gana y las filas vacías se ignoran", () => {
  const { ads } = summarizeAdPerformance([
    day("r", "2026-10-07", { adName: "Viejo" }),
    day("r", "2026-10-09", { adName: "Nuevo" }),
    day("vacio", "2026-10-09", { spend: 0, impressions: 0 }),
  ]);
  assert.deepEqual(ads.map((a) => a.adName), ["Nuevo"]);
});
