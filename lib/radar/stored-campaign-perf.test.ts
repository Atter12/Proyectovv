import assert from "node:assert/strict";
import test from "node:test";
import { campaignPerfFromAdDays, coveredDays, rangeIsCovered } from "./stored-campaign-perf.ts";

test("agrupa los anuncios por campaña y recalcula CTR, CPC, CPM y costo por conversión", () => {
  const rows = campaignPerfFromAdDays([
    { advertiserId: "1", campaignId: "c1", campaignName: "Viejo", statDate: "2026-10-08", spend: 10, impressions: 1000, clicks: 10, conversions: 2 },
    { advertiserId: "1", campaignId: "c1", campaignName: "TESTEO/GLUCORA", statDate: "2026-10-09", spend: 30, impressions: 3000, clicks: 30, conversions: 8 },
    { advertiserId: "1", campaignId: "c2", campaignName: "Otra", statDate: "2026-10-09", spend: 5, impressions: 500, clicks: 0, conversions: null },
    { advertiserId: "1", campaignId: null, campaignName: null, statDate: "2026-10-09", spend: 99, impressions: 1, clicks: 1, conversions: 1 },
  ]);
  assert.deepEqual(rows[0], {
    advertiserId: "1",
    campaignId: "c1",
    campaignName: "TESTEO/GLUCORA",
    spend: 40,
    impressions: 4000,
    clicks: 40,
    ctr: 1,
    cpc: 1,
    cpm: 10,
    conversions: 10,
    costPerConversion: 4,
  });
  assert.equal(rows[1]!.conversions, null);
  assert.equal(rows[1]!.costPerConversion, null);
  assert.equal(rows.length, 2);
});

test("cada corrida cubre 3 días; un hueco obliga a consultar en vivo", () => {
  const covered = coveredDays(["2026-10-05", "2026-10-08"]);
  assert.equal(rangeIsCovered("2026-10-03", "2026-10-08", covered), true);
  assert.equal(rangeIsCovered("2026-10-02", "2026-10-08", covered), false);
  assert.equal(rangeIsCovered("2026-10-06", "2026-10-09", covered), false);
  assert.equal(rangeIsCovered("2026-10-09", "2026-10-08", covered), false);
});
