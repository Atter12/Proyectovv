import assert from "node:assert/strict";
import test from "node:test";
import {
  authorHandleFromShareUrl,
  parseTrendingList,
  parseVideoList,
  pickHashtagsForVideoList,
} from "./discovery-parse.ts";

const trending = {
  list: [
    { hashtag_id: "11", hashtag_name: "salud", rank_position: "3", rank_change: "NEW", views: 900, posts: 40, top_country_list: ["PE", "MX"] },
    { hashtag_id: "22", hashtag_name: "#glucosa", rank_position: 1, views: "1200", top_country_list: [{ country_code: "pe" }] },
    { hashtag_id: "33", hashtag_name: "fitnessusa", rank_position: 2, top_country_list: ["US"] },
    { hashtag_id: "44", hashtag_name: "sinpaises", rank_position: 9 },
    { hashtag_id: "11", hashtag_name: "salud", rank_position: 3 },
    { hashtag_name: "sin id" },
  ],
};

test("lee hashtags, quita el # y descarta duplicados o filas sin id", () => {
  const list = parseTrendingList(trending);
  assert.equal(list.length, 4);
  assert.deepEqual(list[1], {
    hashtagId: "22",
    hashtagName: "glucosa",
    rankPosition: 1,
    rankChange: null,
    views: 1200,
    posts: null,
    topCountries: ["PE"],
  });
  assert.equal(list[0]!.rankChange, "NEW");
});

test("solo elige hashtags donde el país está en el top, ordenados por posición", () => {
  const picked = pickHashtagsForVideoList(parseTrendingList(trending), "pe");
  assert.deepEqual(
    picked.map((h) => h.hashtagName),
    ["glucosa", "salud", "sinpaises"],
  );
});

test("nunca pide más de 10 hashtags por consulta", () => {
  const many = parseTrendingList({
    list: Array.from({ length: 15 }, (_, i) => ({ hashtag_id: String(i), hashtag_name: `h${i}`, rank_position: i })),
  });
  assert.equal(pickHashtagsForVideoList(many, "PE", 50).length, 10);
});

test("lee los videos con su posición dentro del hashtag", () => {
  const videos = parseVideoList({
    list: [
      {
        hashtag_id: "22",
        hashtag_name: "glucosa",
        top_video_list: [
          { video_id: "v1", share_url: "https://www.tiktok.com/@tienda.pe/video/v1", embed_url: "https://www.tiktok.com/embed/v1" },
          { video_id: "v2" },
          { video_id: "v3", share_url: "https://www.tiktok.com/@otra/video/v3" },
        ],
      },
    ],
  });
  assert.deepEqual(
    videos.map((v) => [v.videoId, v.rank, v.hashtagName, v.embedUrl]),
    [
      ["v1", 1, "glucosa", "https://www.tiktok.com/embed/v1"],
      ["v3", 3, "glucosa", null],
    ],
  );
});

test("respuestas vacías o raras no rompen", () => {
  assert.deepEqual(parseTrendingList(null), []);
  assert.deepEqual(parseVideoList({ list: "x" }), []);
});

test("saca el usuario del enlace del video", () => {
  assert.equal(authorHandleFromShareUrl("https://www.tiktok.com/@tienda.pe/video/123?x=1"), "tienda.pe");
  assert.equal(authorHandleFromShareUrl("https://vm.tiktok.com/abc"), null);
});
