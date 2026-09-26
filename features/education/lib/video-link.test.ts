import assert from "node:assert/strict";
import test from "node:test";
import { canonicalLessonVideoUrl, lessonEmbedUrl } from "./loom.ts";

const DRIVE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

test("acepta un share de Loom", () => {
  const share = "https://www.loom.com/share/abcd1234";
  assert.equal(canonicalLessonVideoUrl(share), share);
  assert.equal(
    lessonEmbedUrl(share),
    "https://www.loom.com/embed/abcd1234?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true",
  );
});

test("acepta un archivo de Drive y lo convierte a preview", () => {
  assert.equal(
    canonicalLessonVideoUrl(
      `https://drive.google.com/file/d/${DRIVE_ID}/view?usp=sharing`,
    ),
    `https://drive.google.com/file/d/${DRIVE_ID}/view`,
  );
  assert.equal(
    lessonEmbedUrl(`https://drive.google.com/open?id=${DRIVE_ID}`),
    `https://drive.google.com/file/d/${DRIVE_ID}/preview`,
  );
  assert.equal(
    canonicalLessonVideoUrl(`https://drive.google.com/uc?export=download&id=${DRIVE_ID}`),
    `https://drive.google.com/file/d/${DRIVE_ID}/view`,
  );
});

test("rechaza carpetas y otros dominios", () => {
  assert.equal(
    canonicalLessonVideoUrl("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz"),
    null,
  );
  assert.equal(canonicalLessonVideoUrl("https://example.com/file/d/abcd"), null);
  assert.equal(lessonEmbedUrl(""), null);
});
