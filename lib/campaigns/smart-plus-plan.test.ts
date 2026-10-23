import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAddVideosUpdate,
  buildSmartPlusPlan,
  tiktokUtcTime,
  validateSmartPlusPlan,
  withTikTokUtm,
  type SmartPlusPlanInput,
} from "./smart-plus-plan.ts";

const input = (over: Partial<SmartPlusPlanInput> = {}): SmartPlusPlanInput => ({
  advertiserId: "7001",
  campaignName: "Sambas · Lima",
  dailyBudget: 30,
  country: "PE",
  pixelId: "7656189534929321991",
  videoIds: ["v1", "v2", "v1"],
  adTexts: ["Las zapatillas que todos buscan", " "],
  landingPageUrl: "https://tienda.pe/products/samba",
  identity: { type: "TT_USER", id: "abc-123" },
  ...over,
});
const NOW = new Date("2026-10-22T18:05:09.123Z");

test("valida lo mínimo para lanzar", () => {
  assert.deepEqual(validateSmartPlusPlan(input()), []);
  assert.deepEqual(
    validateSmartPlusPlan(input({ dailyBudget: 10, pixelId: "", videoIds: [], adTexts: [""], landingPageUrl: "tienda.pe" })),
    ["lowBudget", "noPixel", "noVideos", "noText", "badUrl"],
  );
  assert.deepEqual(validateSmartPlusPlan(input({ identity: { type: "BC_AUTH_TT", id: "x" } })), ["noIdentity"]);
});

test("campaña de ventas web pausada con presupuesto diario en la campaña", () => {
  const { campaign } = buildSmartPlusPlan(input(), { requestId: "99", now: NOW });
  assert.equal(campaign.objective_type, "WEB_CONVERSIONS");
  assert.equal(campaign.sales_destination, "WEBSITE");
  assert.equal(campaign.budget_mode, "BUDGET_MODE_DYNAMIC_DAILY_BUDGET");
  assert.equal(campaign.budget_optimize_on, true);
  assert.equal(campaign.budget, 30);
  assert.equal(campaign.operation_status, "DISABLE");
  assert.equal(campaign.request_id, "991");
});

test("grupo optimiza por compras del píxel en el país elegido", () => {
  const { adgroup } = buildSmartPlusPlan(input({ country: "CO", gender: "GENDER_FEMALE", ageGroups: ["AGE_25_34", "AGE_25_34"] }), {
    requestId: "99",
    now: NOW,
  });
  assert.equal(adgroup.optimization_goal, "CONVERT");
  assert.equal(adgroup.optimization_event, "SHOPPING");
  assert.equal(adgroup.pixel_id, "7656189534929321991");
  assert.equal(adgroup.bid_type, "BID_TYPE_NO_BID");
  assert.equal(adgroup.schedule_start_time, "2026-10-22 18:05:09");
  assert.deepEqual(adgroup.targeting_spec, { location_ids: ["3686110"], gender: "GENDER_FEMALE", age_groups: ["AGE_25_34"] });
});

test("anuncio: videos sin repetir, textos limpios, link con UTM e identidad", () => {
  const { ad } = buildSmartPlusPlan(
    input({ identity: { type: "BC_AUTH_TT", id: "id1", bcId: "bc9" }, videoCovers: { v1: "tos-cover-1" } }),
    { requestId: "1", now: NOW },
  );
  const creatives = ad.creative_list as { creative_info: Record<string, unknown> }[];
  assert.equal(creatives.length, 2);
  assert.deepEqual(creatives[0].creative_info, {
    ad_format: "SINGLE_VIDEO",
    video_info: { video_id: "v1" },
    image_info: [{ web_uri: "tos-cover-1" }],
    identity_type: "BC_AUTH_TT",
    identity_id: "id1",
    identity_authorized_bc_id: "bc9",
  });
  assert.deepEqual(ad.ad_text_list, [{ ad_text: "Las zapatillas que todos buscan" }]);
  const url = (ad.landing_page_url_list as { landing_page_url: string }[])[0].landing_page_url;
  assert.match(url, /utm_source=tiktok/);
  assert.match(url, /utm_id=__CAMPAIGN_ID__/);
  // Sin botón suelto: va el paquete de botones en la configuración.
  assert.equal("call_to_action_list" in ad, false);
  const withCta = buildSmartPlusPlan(input({ callToActionId: "cta9" }), { requestId: "1", now: NOW }).ad;
  assert.equal((withCta.ad_configuration as Record<string, unknown>).call_to_action_id, "cta9");
});

test("UTM no pisa los que ya trae el link", () => {
  const url = withTikTokUtm("https://tienda.pe/p?utm_source=ig&x=1");
  assert.match(url, /utm_source=ig/);
  assert.match(url, /x=1/);
  assert.match(url, /utm_campaign=__CAMPAIGN_NAME__/);
});

test("hora UTC en formato TikTok", () => {
  assert.equal(tiktokUtcTime(NOW), "2026-10-22 18:05:09");
});

const liveAd = (): Record<string, unknown> => ({
  advertiser_id: "7001",
  smart_plus_ad_id: "9001",
  ad_name: "Sambas · anuncio",
  ad_text_list: [{ ad_text: "Las que todos buscan" }],
  landing_page_url_list: [{ landing_page_url: "https://tienda.pe/?utm_source=tiktok" }],
  ad_configuration: { call_to_action_id: "77", tracking_info: { tracking_pixel_id: "55" } },
  creative_list: [
    {
      ad_material_id: "m1",
      material_operation_status: "ENABLE",
      creative_info: { ad_format: "SINGLE_VIDEO", identity_id: "id-1", identity_type: "TT_USER", video_info: { video_id: "v1" }, image_info: [{ web_uri: "c1" }] },
    },
    {
      ad_material_id: "m2",
      material_operation_status: "DISABLE",
      creative_info: { ad_format: "SINGLE_VIDEO", identity_id: "id-1", identity_type: "TT_USER", video_info: { video_id: "v2" }, image_info: [{ web_uri: "c2" }] },
    },
  ],
});

test("suma videos sin perder los que ya están (ni los pausados)", () => {
  const r = buildAddVideosUpdate(liveAd(), [
    { videoId: "v3", coverUri: "c3" },
    { videoId: "v1", coverUri: "c1" },
  ]);
  assert.ok(r.ok);
  assert.deepEqual(r.added, ["v3"]);
  const list = r.body.creative_list as Record<string, unknown>[];
  assert.deepEqual(list.map((c) => c.ad_material_id ?? null), ["m1", "m2", null]);
  assert.deepEqual(list[2].creative_info, {
    ad_format: "SINGLE_VIDEO",
    video_info: { video_id: "v3" },
    image_info: [{ web_uri: "c3" }],
    identity_type: "TT_USER",
    identity_id: "id-1",
  });
  assert.equal(r.body.smart_plus_ad_id, "9001");
  assert.deepEqual(r.body.ad_configuration, { call_to_action_id: "77", tracking_info: { tracking_pixel_id: "55" } });
  assert.deepEqual(r.body.ad_text_list, [{ ad_text: "Las que todos buscan" }]);
});

test("no manda nada si no hay videos nuevos, falta portada o se pasa del tope", () => {
  assert.deepEqual(buildAddVideosUpdate(liveAd(), []), { ok: false, error: "noVideos" });
  assert.deepEqual(buildAddVideosUpdate(liveAd(), [{ videoId: "v2", coverUri: "c2" }]), { ok: false, error: "nothingNew" });
  assert.deepEqual(buildAddVideosUpdate(liveAd(), [{ videoId: "v9", coverUri: null }]), { ok: false, error: "noCover" });
  const many = Array.from({ length: 49 }, (_, i) => ({ videoId: `n${i}`, coverUri: "c" }));
  assert.deepEqual(buildAddVideosUpdate(liveAd(), many), { ok: false, error: "tooManyVideos" });
});
