import assert from "node:assert/strict";
import test from "node:test";
import { buildPilotProposals, type PilotDayRow } from "./pilot.ts";

const DAYS = ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"];

/** Un anuncio con el mismo gasto y resultados cada día. */
function ad(
  adId: string,
  perDay: { spend: number; results: number; impressions?: number; clicks?: number },
  over: Partial<PilotDayRow> = {},
  days = DAYS,
): PilotDayRow[] {
  return days.map((statDate) => ({
    advertiserId: "7001",
    adId,
    adgroupId: "g1",
    campaignId: "c1",
    adName: `VIDEO ${adId}`,
    statDate,
    spend: perDay.spend,
    impressions: perDay.impressions ?? 1000,
    clicks: perDay.clicks ?? 15,
    results: perDay.results,
    ...over,
  }));
}

test("ganador y perdedor en el mismo grupo: pausar el perdedor", () => {
  const { proposals, averageCostPerResult } = buildPilotProposals([
    ...ad("gana", { spend: 10, results: 5 }), // $2 por resultado
    ...ad("pierde", { spend: 10, results: 1 }), // $10 por resultado
    ...ad("normal", { spend: 10, results: 3 }, { adgroupId: "g2" }),
  ]);
  // Promedio: 210 / 63 = 3.33
  assert.equal(averageCostPerResult, 3.33);
  assert.equal(proposals[0]!.kind, "pause_loser_same_group");
  const p = proposals[0] as Extract<(typeof proposals)[number], { kind: "pause_loser_same_group" }>;
  assert.equal(p.loser.adId, "pierde");
  assert.equal(p.winner.adId, "gana");
  assert.equal(p.id, "pause_loser_same_group:7001:pierde");
});

test("perdedor en otro grupo: pausar y el ganador queda como recomendación de escalar", () => {
  const { proposals } = buildPilotProposals([
    ...ad("gana", { spend: 10, results: 5 }),
    ...ad("pierde", { spend: 10, results: 1 }, { adgroupId: "g2" }),
  ]);
  assert.deepEqual(proposals.map((p) => p.kind), ["pause_loser", "scale_winner"]);
  const scale = proposals[1] as Extract<(typeof proposals)[number], { kind: "scale_winner" }>;
  assert.equal(scale.maxIncreasePct, 50);
  // Promedio 140 / 42 = 3.33; el ganador cuesta 2: 40% más barato.
  assert.equal(scale.cheaperPct, 40);
});

test("nada en aprendizaje: pocos días o poco gasto no dan propuestas", () => {
  const short = DAYS.slice(-3);
  const { proposals } = buildPilotProposals([
    ...ad("gana", { spend: 10, results: 5 }, {}, short),
    ...ad("pierde", { spend: 10, results: 0 }, {}, short),
    ...ad("barato", { spend: 1, results: 0 }),
  ]);
  assert.deepEqual(proposals, []);
});

test("un anuncio que ya no gasta no se propone pausar", () => {
  const { proposals } = buildPilotProposals([
    ...ad("gana", { spend: 10, results: 5 }),
    ...ad("viejo", { spend: 10, results: 0 }, {}, DAYS.slice(0, 5)),
  ]);
  assert.ok(!proposals.some((p) => p.kind.startsWith("pause")));
});

test("todo pierde: no mover plata, cambiar de creativo", () => {
  const { proposals } = buildPilotProposals([
    ...ad("a", { spend: 10, results: 1 }),
    ...ad("b", { spend: 10, results: 1 }, { adgroupId: "g2" }),
    ...ad("c", { spend: 30, results: 30 }, { adgroupId: "g3" }, DAYS.slice(0, 3)), // baja el promedio, en aprendizaje
  ]);
  assert.ok(proposals.some((p) => p.kind === "all_losing"));
  assert.ok(!proposals.some((p) => p.kind === "scale_winner"));
});

test("anuncio cansado: el CTR de los últimos días cayó frente a los primeros", () => {
  const days = Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  const rows = days.map((statDate, i) => ({
    advertiserId: "7001",
    adId: "cansado",
    adgroupId: "g1",
    campaignId: "c1",
    adName: "VIDEO cansado",
    statDate,
    spend: 10,
    impressions: 1000,
    clicks: i < 5 ? 30 : i >= 9 ? 12 : 20,
    results: 3,
  }));
  const { proposals } = buildPilotProposals(rows);
  const fatigue = proposals.find((p) => p.kind === "refresh_fatigued") as
    | Extract<(typeof proposals)[number], { kind: "refresh_fatigued" }>
    | undefined;
  assert.ok(fatigue);
  assert.equal(fatigue!.ctrDropPct, 60);
});

test("lo descartado por el cliente no vuelve a aparecer", () => {
  const rows = [...ad("gana", { spend: 10, results: 5 }), ...ad("pierde", { spend: 10, results: 1 })];
  const { proposals } = buildPilotProposals(rows, {
    dismissedIds: new Set(["pause_loser_same_group:7001:pierde"]),
  });
  assert.ok(!proposals.some((p) => p.id === "pause_loser_same_group:7001:pierde"));
});
