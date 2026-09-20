import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanCreativeDisplayName,
  creativeCardTitle,
} from "./clean-display-name.ts";

test("colapsa el filename de TikTok a Video N", () => {
  assert.equal(
    cleanCreativeDisplayName("VIDEO 1_abc123.mp4_VIDEO 1"),
    "Video 1",
  );
});

test("si varios archivos se llaman Video 1, la card usa el texto del anuncio", () => {
  const title = creativeCardTitle({
    adName: "VIDEO 1_abc.mp4",
    adText: "Baja de peso en 7 días con este té",
  });
  assert.match(title, /Baja de peso/);
  assert.match(title, /Video 1/);
  assert.notEqual(title, "Video 1");
});

test("un nombre ya claro no se reemplaza", () => {
  assert.equal(
    creativeCardTitle({
      adName: "Hook verano",
      adText: "Texto largo que no debe tapar el nombre",
    }),
    "Hook verano",
  );
});
