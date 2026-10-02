import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDebtLinkMonth,
  resolvePublicDebtLinkMonth,
} from "./debt-link-month.ts";

test("en octubre el link abre setiembre", () => {
  assert.equal(defaultDebtLinkMonth("2026-10", "2026-09"), "2026-09");
  assert.equal(resolvePublicDebtLinkMonth(undefined, "2026-10", "2026-09"), "2026-09");
});

test("un ?m= explicito se respeta", () => {
  assert.equal(resolvePublicDebtLinkMonth("2026-10", "2026-10", "2026-09"), "2026-10");
  assert.equal(resolvePublicDebtLinkMonth("2026-09", "2026-10", "2026-09"), "2026-09");
});

test("el primer mes visible no tiene anterior", () => {
  assert.equal(defaultDebtLinkMonth("2026-09", "2026-09"), "2026-09");
});

test("en noviembre abre octubre", () => {
  assert.equal(defaultDebtLinkMonth("2026-11", "2026-09"), "2026-10");
});
