import assert from "node:assert/strict";
import test from "node:test";
import { partnerInkOn } from "./partners.shared";

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
