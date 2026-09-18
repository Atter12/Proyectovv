import assert from "node:assert/strict";
import test from "node:test";
import {
  mapTikTokMediaPreviewRows,
  mediaKindFrom,
  findNestedVideoId,
} from "./tiktok-media-preview.ts";

test("toma cover y preview de TikTok y descarta urls raras", () => {
  const map = mapTikTokMediaPreviewRows([
    {
      video_id: "v1",
      video_cover_url: "https://cdn.example/cover.jpg",
      preview_url: "https://cdn.example/play.mp4",
    },
    { image_id: "i1", image_url: "https://cdn.example/still.jpg" },
    { video_id: "bad", preview_url: "javascript:alert(1)" },
    { video_id: "" },
  ]);
  assert.deepEqual(map.get("v1"), {
    posterUrl: "https://cdn.example/cover.jpg",
    previewUrl: "https://cdn.example/play.mp4",
  });
  assert.equal(map.get("i1")?.posterUrl, "https://cdn.example/still.jpg");
  assert.equal(map.has("bad"), false);
  assert.equal(map.size, 2);
});

test("el tipo de medio sale del archivo o de tener preview", () => {
  assert.equal(
    mediaKindFrom({
      mimeType: "video/mp4",
      previewUrl: "https://cdn.example/a.mp4",
    }),
    "video",
  );
  assert.equal(
    mediaKindFrom({
      assetType: "image",
      posterUrl: "https://cdn.example/a.jpg",
    }),
    "image",
  );
  assert.equal(mediaKindFrom({}), null);
});

test("el video de Smart+ está dentro de creative_list", () => {
  assert.equal(
    findNestedVideoId({
      smart_plus_ad_id: "sp1",
      creative_list: [
        { creative_info: { video_info: { video_id: "v-real" } } },
      ],
    }),
    "v-real",
  );
  assert.equal(findNestedVideoId({ ad_name: "Video 1" }), null);
});
