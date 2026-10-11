import assert from "node:assert/strict";
import test from "node:test";
import { mapAdvertisersToClientes, parseAdDailyList } from "./ad-daily-parse.ts";

test("lee una fila del reporte por anuncio", () => {
  const [row] = parseAdDailyList(
    "7001",
    [
      {
        dimensions: { ad_id: "a1", stat_time_day: "2026-10-10 00:00:00" },
        metrics: {
          spend: "12.345",
          impressions: "1500",
          clicks: "30",
          ctr: "2.0012",
          conversion: "4",
          cost_per_conversion: "3.08625",
          result: "4",
          cost_per_result: "3.0862",
          video_play_actions: "1400",
          video_watched_2s: "700",
          video_watched_6s: "350",
          average_video_play: "4.21",
          campaign_id: "c1",
          campaign_name: "TESTEO/GLUCORA/WEB",
          adgroup_id: "g1",
          ad_name: "VIDEO 1",
        },
      },
    ],
    "2026-10-09",
  );
  assert.deepEqual(row, {
    advertiserId: "7001",
    adId: "a1",
    statDate: "2026-10-10",
    campaignId: "c1",
    campaignName: "TESTEO/GLUCORA/WEB",
    adgroupId: "g1",
    adName: "VIDEO 1",
    spend: 12.35,
    impressions: 1500,
    clicks: 30,
    ctr: 2.0012,
    conversions: 4,
    costPerConversion: 3.0863,
    results: 4,
    costPerResult: 3.0862,
    videoPlayActions: 1400,
    videoWatched2s: 700,
    videoWatched6s: 350,
    averageVideoPlay: 4.21,
  });
});

test("descarta anuncios sin gasto ni impresiones y filas sin ad_id", () => {
  const rows = parseAdDailyList(
    "7001",
    [
      { dimensions: { ad_id: "vacio" }, metrics: { spend: "0", impressions: "0" } },
      { dimensions: {}, metrics: { spend: "5" } },
      { dimensions: { ad_id: "ok" }, metrics: { spend: "0", impressions: "10", ctr: "-" } },
    ],
    "2026-10-09",
  );
  assert.deepEqual(rows.map((r) => [r.adId, r.statDate, r.ctr]), [["ok", "2026-10-09", null]]);
});

test("una respuesta que no es lista devuelve vacío", () => {
  assert.deepEqual(parseAdDailyList("1", undefined, "2026-10-09"), []);
});

test("anunciante con un solo cliente se mapea; con dos queda fuera", () => {
  const { byAdvertiser, conflicts } = mapAdvertisersToClientes([
    { advertiserId: "1", hecomClienteId: "ana" },
    { advertiserId: "1", hecomClienteId: "ana" },
    { advertiserId: "2", hecomClienteId: "ana" },
    { advertiserId: "2", hecomClienteId: "beto" },
    { advertiserId: "3", hecomClienteId: null },
    { advertiserId: " ", hecomClienteId: "carla" },
  ]);
  assert.deepEqual([...byAdvertiser], [["1", "ana"]]);
  assert.deepEqual(conflicts, ["2"]);
});
