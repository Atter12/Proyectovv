import assert from "node:assert/strict";
import test from "node:test";
import {
  canSwitchTesterDashboardMode,
  parseTesterDashboardMode,
} from "./tester-dashboard-mode.ts";

test("solo la cuenta tester cambia de modo", () => {
  assert.equal(canSwitchTesterDashboardMode("sandrowonmer@gmail.com"), true);
  assert.equal(canSwitchTesterDashboardMode(" SandroWonmer@gmail.com "), true);
  assert.equal(canSwitchTesterDashboardMode("cliente@tienda.com"), false);
  assert.equal(canSwitchTesterDashboardMode(null), false);
});

test("sin cookie el tester sigue en cliente", () => {
  assert.equal(parseTesterDashboardMode(undefined), "cliente");
  assert.equal(parseTesterDashboardMode("gerente"), "gerente");
  assert.equal(parseTesterDashboardMode("otra"), "cliente");
});
