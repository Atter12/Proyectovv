import assert from "node:assert/strict";
import test from "node:test";
import { buildPilotProposals, type PilotDayRow } from "../radar/pilot.ts";
import { buildLaunchActions as build, type LaunchRef } from "./launch-optimizer.ts";

const buildLaunchActions = (rows: PilotDayRow[], launches: LaunchRef[], opts: { dismissedIds?: Set<string> } = {}) =>
  build(rows, launches, { buildPilotProposals, ...opts });

const DATES = ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"];

/** Filas diarias de un video: el mismo gasto/resultados cada día. */
function video(
  campaignId: string,
  adId: string,
  perDay: { spend: number; results: number; impressions?: number; clicks?: number },
  dates = DATES,
): PilotDayRow[] {
  return dates.map((statDate) => ({
    advertiserId: "7001",
    adId,
    adgroupId: `${campaignId}-g`,
    campaignId,
    adName: `Video ${adId}`,
    statDate,
    spend: perDay.spend,
    impressions: perDay.impressions ?? 2000,
    clicks: perDay.clicks ?? 30,
    results: perDay.results,
  }));
}

const launch = (over: Partial<LaunchRef> = {}): LaunchRef => ({
  id: "L1",
  advertiserId: "7001",
  campaignId: "C1",
  dailyBudget: 30,
  maxDailyBudget: null,
  initialDailyBudget: 30,
  ...over,
});

test("solo actúa sobre las campañas lanzadas", () => {
  // La campaña del cliente (C9) pierde, pero no es nuestra: no se toca.
  const rows = [...video("C1", "a", { spend: 15, results: 3 }), ...video("C9", "z", { spend: 20, results: 0 })];
  const actions = buildLaunchActions(rows, [launch()]);
  assert.ok(actions.every((a) => a.campaignId === "C1"));
});

test("pausa el video que pierde dentro de la campaña", () => {
  const rows = [
    ...video("C1", "win", { spend: 10, results: 4 }),
    ...video("C1", "lose", { spend: 10, results: 0 }),
  ];
  const actions = buildLaunchActions(rows, [launch()]);
  const pause = actions.find((a) => a.kind === "pause_video");
  assert.ok(pause && pause.kind === "pause_video");
  assert.equal(pause.creativeId, "lose");
  assert.equal(pause.launchId, "L1");
});

test("sube 20% si vende barato y gasta todo su presupuesto", () => {
  const rows = [
    ...video("C1", "a", { spend: 30, results: 6 }), // $5 por compra, gasta los 30
    ...video("C9", "z", { spend: 50, results: 5 }), // resto del cliente a $10
  ];
  const actions = buildLaunchActions(rows, [launch()]);
  const budget = actions.find((a) => a.kind === "raise_budget");
  assert.ok(budget && budget.kind === "raise_budget");
  assert.equal(budget.fromBudget, 30);
  assert.equal(budget.toBudget, 36);
  assert.ok(budget.cheaperPct > 20);
});

test("no sube si no gasta su presupuesto (el presupuesto no la frena)", () => {
  const rows = [...video("C1", "a", { spend: 12, results: 4 }), ...video("C9", "z", { spend: 50, results: 5 })];
  const actions = buildLaunchActions(rows, [launch()]);
  assert.equal(actions.some((a) => a.kind === "raise_budget"), false);
});

test("no sube si es más cara que el promedio del cliente", () => {
  const rows = [...video("C1", "a", { spend: 30, results: 2 }), ...video("C9", "z", { spend: 50, results: 10 })];
  assert.equal(buildLaunchActions(rows, [launch()]).some((a) => a.kind === "raise_budget"), false);
});

test("nada mientras aprende: pocos días con gasto", () => {
  const rows = [
    ...video("C1", "win", { spend: 30, results: 6 }, DATES.slice(-2)),
    ...video("C1", "lose", { spend: 10, results: 0 }, DATES.slice(-2)),
    ...video("C9", "z", { spend: 50, results: 5 }),
  ];
  assert.deepEqual(buildLaunchActions(rows, [launch()]), []);
});

test("el aumento respeta el techo", () => {
  const rows = [...video("C1", "a", { spend: 55, results: 11 }), ...video("C9", "z", { spend: 50, results: 5 })];
  const actions = buildLaunchActions(rows, [launch({ dailyBudget: 55, initialDailyBudget: 30 })]);
  const budget = actions.find((a) => a.kind === "raise_budget");
  assert.ok(budget && budget.kind === "raise_budget");
  assert.equal(budget.toBudget, 60); // techo: el doble del inicial
  const capped = buildLaunchActions(rows, [launch({ dailyBudget: 60, initialDailyBudget: 30 })]);
  assert.equal(capped.some((a) => a.kind === "raise_budget"), false);
});

test("lo descartado no vuelve a salir", () => {
  const rows = [
    ...video("C1", "win", { spend: 10, results: 4 }),
    ...video("C1", "lose", { spend: 10, results: 0 }),
  ];
  const first = buildLaunchActions(rows, [launch()]);
  const pause = first.find((a) => a.kind === "pause_video")!;
  const again = buildLaunchActions(rows, [launch()], { dismissedIds: new Set([pause.id]) });
  assert.equal(again.some((a) => a.id === pause.id), false);
});
