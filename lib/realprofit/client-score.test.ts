import assert from "node:assert/strict";
import test from "node:test";
import { computeClienteScore, type ClienteScoreInput } from "./client-score.ts";

function base(over: Partial<ClienteScoreInput> = {}): ClienteScoreInput {
  return {
    spend7d: 80,
    spend30d: 240,
    pacingLabel: "normal",
    avgCtr: 1.2,
    clicks: 200,
    conversions: 8,
    impressions: 12000,
    hasCodLink: false,
    aboveBreakEven: null,
    warnKinds: [],
    burnStatus: "none",
    allocated90dUsd: 300,
    spent90dUsd: 220,
    deposits90d: 4,
    failedDeposits90d: 0,
    openTickets: 0,
    ...over,
  };
}

test("sin gasto no inventa un buen cliente", () => {
  const score = computeClienteScore(
    base({
      spend7d: 0,
      spend30d: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      avgCtr: null,
    }),
  );
  assert.equal(score.verdict, "no_base");
  assert.equal(score.score, null);
});

test("gasto sano, sin quema y depósitos limpios queda en verde", () => {
  const score = computeClienteScore(base());
  assert.equal(score.verdict, "green");
  assert.ok((score.score ?? 100) <= 29);
  assert.equal(
    score.factors.find((f) => f.id === "collections")?.note,
    "collections_clean",
  );
});

test("depósitos Holistic limpios no se caen por fallos Stripe irrelevantes (ya filtrados)", () => {
  const score = computeClienteScore(
    base({
      deposits90d: 5,
      failedDeposits90d: 0,
    }),
  );
  assert.equal(
    score.factors.find((f) => f.id === "collections")?.note,
    "collections_clean",
  );
  assert.ok((score.factors.find((f) => f.id === "collections")?.points ?? 0) >= 90);
});

test("quema crítica y cobros Holistic fallidos suben a naranja o rojo", () => {
  const score = computeClienteScore(
    base({
      avgCtr: 0.15,
      clicks: 400,
      conversions: 0,
      impressions: 20000,
      spend7d: 90,
      spend30d: 280,
      warnKinds: ["low_ctr"],
      burnStatus: "critical",
      pacingLabel: "acelerando",
      allocated90dUsd: 100,
      spent90dUsd: 180,
      failedDeposits90d: 3,
      deposits90d: 1,
      openTickets: 3,
    }),
  );
  assert.ok(score.verdict === "orange" || score.verdict === "red");
  assert.ok((score.score ?? 0) >= 60);
  const credit = score.factors.find((f) => f.id === "credit");
  assert.ok(
    credit?.note === "credit_risk" || credit?.note === "credit_burn_fast",
  );
});

test("crédito 90d sano no se marca como quema rápida solo por saldo info", () => {
  const score = computeClienteScore(
    base({
      burnStatus: "info",
      allocated90dUsd: 400,
      spent90dUsd: 280,
      pacingLabel: "normal",
    }),
  );
  const credit = score.factors.find((f) => f.id === "credit");
  assert.notEqual(credit?.note, "credit_burn_fast");
  assert.ok((credit?.points ?? 0) >= 60);
});

test("si no se leen cobros, el score sigue saliendo del resto", () => {
  const score = computeClienteScore(
    base({ deposits90d: null, failedDeposits90d: null }),
  );
  assert.notEqual(score.score, null);
  assert.equal(
    score.factors.find((f) => f.id === "collections")?.note,
    "collections_unknown",
  );
});

test("publicidad usa 30d: sin gasto 30d pero con 7d aún califica", () => {
  const score = computeClienteScore(
    base({
      spend7d: 40,
      spend30d: 40,
      clicks: 50,
      conversions: 2,
      impressions: 4000,
      avgCtr: 1.1,
    }),
  );
  assert.notEqual(score.score, null);
  assert.notEqual(score.factors.find((f) => f.id === "ads")?.points, null);
});

test("crédito agencia no se castiga por gastar más de lo asignado en Holistic", () => {
  const score = computeClienteScore(
    base({
      agencyCredit: true,
      allocated90dUsd: 100,
      spent90dUsd: 900,
      burnStatus: "none",
    }),
  );
  assert.equal(
    score.factors.find((f) => f.id === "credit")?.note,
    "credit_agency",
  );
});
