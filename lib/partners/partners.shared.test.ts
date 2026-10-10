import assert from "node:assert/strict";
import test from "node:test";
import { partnerInkOn, partnerLogoSize, partnerPalette } from "./partners.shared";

test("texto oscuro sobre colores claros", () => {
  assert.equal(partnerInkOn("#ff781f"), "#1c1917");
  assert.equal(partnerInkOn("#ca8a04"), "#1c1917");
  assert.equal(partnerInkOn("#ffffff"), "#1c1917");
});

test("texto blanco sobre colores oscuros", () => {
  assert.equal(partnerInkOn("#1c1917"), "#ffffff");
  assert.equal(partnerInkOn("#2563eb"), "#ffffff");
  assert.equal(partnerInkOn("#7c3aed"), "#ffffff");
});

test("color inválido usa el naranja por defecto", () => {
  assert.equal(partnerInkOn("rojo"), "#1c1917");
});

test("paleta: sin colores propios usa el tema y el secundario copia al principal", () => {
  const pal = partnerPalette({ accentColor: "#ff781f", theme: "dark" });
  assert.equal(pal.background, "#14110f");
  assert.equal(pal.text, "#ffffff");
  assert.equal(pal.secondary, "#ff781f");
  assert.equal(pal.dark, true);
});

test("paleta: colores propios mandan y los inválidos se ignoran", () => {
  const pal = partnerPalette({
    accentColor: "#FF5A2A",
    secondaryColor: "#FFA31F",
    backgroundColor: "#ffffff",
    textColor: "nada",
    theme: "light",
  });
  assert.equal(pal.accent, "#FF5A2A");
  assert.equal(pal.secondary, "#FFA31F");
  assert.equal(pal.background, "#ffffff");
  assert.equal(pal.text, "#1c1917");
  assert.equal(pal.dark, false);
});

test("tamaño del logo: por defecto 40 y dentro de 24–96", () => {
  assert.equal(partnerLogoSize(null), 40);
  assert.equal(partnerLogoSize(10), 24);
  assert.equal(partnerLogoSize(500), 96);
  assert.equal(partnerLogoSize(57.4), 57);
});
