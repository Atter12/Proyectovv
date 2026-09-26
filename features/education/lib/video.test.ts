import assert from "node:assert/strict";
import test from "node:test";
import { EDUCATION_VIDEO_MAX_BYTES, isEducationMp4 } from "./video.ts";

test("acepta un MP4 con marca ftyp dentro del límite", () => {
  const head = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
  assert.equal(isEducationMp4(head, 40_000), true);
  assert.equal(isEducationMp4(head, EDUCATION_VIDEO_MAX_BYTES), true);
});

test("rechaza otro archivo o un MP4 demasiado grande", () => {
  const head = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  assert.equal(isEducationMp4(head, 40_000), false);
  const mp4 = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
  assert.equal(isEducationMp4(mp4, EDUCATION_VIDEO_MAX_BYTES + 1), false);
  assert.equal(isEducationMp4(mp4, 0), false);
});
