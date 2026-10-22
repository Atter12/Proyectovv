import assert from "node:assert/strict";
import test from "node:test";
import {
  borderBackground,
  cutoutMask,
  isUsableCutout,
  maskBounds,
  productColors,
  themeFromColors,
  type RgbaImage,
  type Rgb,
} from "./product-cutout.ts";

/** Imagen de prueba: fondo de un color y un rectángulo (el "producto") de otro. */
function image(w: number, h: number, bg: Rgb, rect?: { x: number; y: number; w: number; h: number; color: Rgb }): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const c = inside ? rect.color : bg;
      const i = (y * w + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

test("fondo blanco parejo se detecta como liso", () => {
  const img = image(40, 60, [255, 255, 255], { x: 10, y: 10, w: 20, h: 40, color: [20, 40, 90] });
  const { color, uniform } = borderBackground(img);
  assert.equal(uniform, true);
  assert.deepEqual(color.map(Math.round), [255, 255, 255]);
});

test("foto con fondo cargado no se toma como lisa", () => {
  const img = image(40, 40, [255, 255, 255]);
  // Mitad del borde de otro color (una mesa, una pared).
  for (let y = 20; y < 40; y++) {
    for (let x = 0; x < 40; x++) {
      const i = (y * 40 + x) * 4;
      img.data[i] = 120;
      img.data[i + 1] = 80;
      img.data[i + 2] = 40;
    }
  }
  assert.equal(borderBackground(img).uniform, false);
});

test("el recorte deja el producto y saca el fondo", () => {
  const img = image(40, 60, [250, 250, 250], { x: 10, y: 10, w: 20, h: 40, color: [20, 40, 90] });
  const mask = cutoutMask(img, [250, 250, 250]);
  assert.equal(mask[0], 0);
  assert.equal(mask[30 * 40 + 20], 255);
  const box = maskBounds(mask, 40, 60);
  assert.ok(box);
  assert.ok(Math.abs(box.x - 10) <= 1 && Math.abs(box.width - 20) <= 2);
  assert.equal(isUsableCutout(mask), true);
});

test("un blanco encerrado dentro del producto no se borra", () => {
  const img = image(40, 60, [255, 255, 255], { x: 8, y: 8, w: 24, h: 44, color: [10, 10, 10] });
  // Etiqueta blanca adentro.
  for (let y = 25; y < 35; y++) {
    for (let x = 14; x < 26; x++) {
      const i = (y * 40 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    }
  }
  const mask = cutoutMask(img, [255, 255, 255]);
  assert.equal(mask[30 * 40 + 20], 255);
});

test("sin producto el recorte no sirve", () => {
  const img = image(30, 30, [255, 255, 255]);
  const mask = cutoutMask(img, [255, 255, 255]);
  assert.equal(isUsableCutout(mask), false);
  assert.equal(maskBounds(mask, 30, 30), null);
});

test("producto azul: el fondo del video toma tono azul", () => {
  const img = image(40, 60, [255, 255, 255], { x: 10, y: 10, w: 20, h: 40, color: [25, 60, 140] });
  const mask = cutoutMask(img, [255, 255, 255]);
  const colors = productColors(img, mask);
  assert.ok(colors.length > 0);
  const theme = themeFromColors(colors);
  const hue = Number(/hsl\((\d+)/.exec(theme.bgTop)?.[1]);
  assert.ok(hue >= 200 && hue <= 240, `tono ${hue}`);
});

test("producto negro: fondo grafito con acento plateado", () => {
  const img = image(40, 60, [255, 255, 255], { x: 10, y: 10, w: 20, h: 40, color: [12, 12, 14] });
  const mask = cutoutMask(img, [255, 255, 255]);
  const theme = themeFromColors(productColors(img, mask));
  assert.match(theme.accent, /hsl\(\d+ \d+% 84%\)/);
});
