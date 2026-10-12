import { test } from "node:test";
import assert from "node:assert/strict";
import { signVideoToken, verifyVideoToken } from "./video-token.ts";

const payload = {
  videoId: "7479073749120158998",
  shareUrl: "https://www.tiktok.com/@perez.farmaceuticos/video/7479073749120158998",
  caption: "Magnesio para dormir",
  tags: { format: "tutorial" as const, pace: "medium" as const },
  hashtags: ["magnesio"],
};

test("un token firmado vuelve igual", () => {
  const token = signVideoToken(payload, "s3cret", 1_000);
  assert.deepEqual(verifyVideoToken(token, "s3cret", 2_000), payload);
});

test("rechaza tokens alterados, con otra clave o caducados", () => {
  const token = signVideoToken(payload, "s3cret", 1_000);
  const [body, mac] = token.split(".");
  const forged = Buffer.from(Buffer.from(body!, "base64url").toString().replace("tutorial", "demo")).toString("base64url");
  assert.equal(verifyVideoToken(`${forged}.${mac}`, "s3cret", 2_000), null);
  assert.equal(verifyVideoToken(token, "otra", 2_000), null);
  assert.equal(verifyVideoToken(token, "s3cret", 1_000 + 25 * 3600 * 1000), null);
  assert.equal(verifyVideoToken("basura", "s3cret"), null);
  assert.equal(verifyVideoToken(42, "s3cret"), null);
});
