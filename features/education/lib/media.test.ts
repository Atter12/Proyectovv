import assert from "node:assert/strict";
import test from "node:test";
import { educationLessonSlug, educationPosterKind } from "./media.ts";

test("el slug del tutorial sale del título", () => {
  assert.equal(
    educationLessonSlug("Cómo recargar tu cartera", "ab12cd"),
    "como-recargar-tu-cartera-ab12cd",
  );
  assert.equal(educationLessonSlug("!!!", "zz"), "tutorial-zz");
});

test("la portada acepta png, jpg, webp y gif, y rechaza otro archivo", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  assert.equal(educationPosterKind(png, "image/png"), "png");
  assert.equal(educationPosterKind(png, "image/jpeg"), null);
  assert.equal(educationPosterKind(Uint8Array.from([1, 2, 3, 4]), ""), null);
  assert.equal(educationPosterKind(new Uint8Array(4 * 1024 * 1024 + 1), "image/png"), null);
});
