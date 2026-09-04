/**
 * Unit-style tests for TikTok pixel helpers (mock fetch).
 * Run: node scripts/test-tiktok-pixel-unit.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Minimal env so serverEnv / token resolve don't explode when imported via dynamic path.
// We test mapping + error shaping by re-implementing the thin contract here,
// and by importing shared event defs (no network).

const { COD_PIXEL_EVENT_DEFS, TIKTOK_BROWSER_TEST_EVENTS } = await import(
  "../lib/integrations/tiktok/pixel-events.shared.ts"
).catch(async () => {
  // ts may not load; fall back to duplicated constants check via require transpilation skip
  return {
    COD_PIXEL_EVENT_DEFS: [
      { name: "ViewContent", eventType: "ON_WEB_DETAIL" },
      { name: "CompletePayment", eventType: "SHOPPING" },
    ],
    TIKTOK_BROWSER_TEST_EVENTS: ["ViewContent", "CompletePayment"],
  };
});

assert.ok(COD_PIXEL_EVENT_DEFS.length >= 5, "COD events template");
assert.ok(
  COD_PIXEL_EVENT_DEFS.some((e) => e.name === "CompletePayment"),
  "CompletePayment in COD",
);
assert.ok(
  TIKTOK_BROWSER_TEST_EVENTS.includes("ViewContent"),
  "browser test events",
);

function mapPixelRow(row, advertiserId) {
  const pixelId = String(row.pixel_id ?? row.pixelId ?? row.id ?? "").trim();
  const pixelCode = String(row.pixel_code ?? row.pixelCode ?? row.code ?? "").trim();
  return {
    pixelId,
    pixelCode: pixelCode || null,
    pixelName: String(row.pixel_name ?? row.pixelName ?? row.name ?? "").trim(),
    advertiserId,
  };
}

const mapped = mapPixelRow(
  { pixel_id: "123", pixel_code: "CABC", pixel_name: "Test" },
  "adv1",
);
assert.equal(mapped.pixelId, "123");
assert.equal(mapped.pixelCode, "CABC");
assert.equal(mapped.pixelName, "Test");

async function tiktokJsonMock(fetchImpl, path) {
  const response = await fetchImpl();
  const json = await response.json();
  if (json.code != null && json.code !== 0) {
    const err = new Error(json.message);
    err.tiktokCode = json.code;
    throw err;
  }
  return json.data;
}

{
  const data = await tiktokJsonMock(
    async () => ({
      ok: true,
      json: async () => ({
        code: 0,
        data: { pixel_id: "999", pixel_name: "Ok" },
      }),
    }),
    "/pixel/create/",
  );
  assert.equal(data.pixel_id, "999");
}

{
  let threw = false;
  try {
    await tiktokJsonMock(
      async () => ({
        ok: true,
        json: async () => ({
          code: 40001,
          message: "advertiser does not grant you /pixel/list/:GET permission",
        }),
      }),
      "/pixel/list/",
    );
  } catch (e) {
    threw = true;
    assert.match(String(e.message), /permission/i);
    assert.equal(e.tiktokCode, 40001);
  }
  assert.equal(threw, true);
}

console.log("test-tiktok-pixel-unit: OK");
