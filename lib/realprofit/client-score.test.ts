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
    failedPayments45d: 0,
    paymentIntents45d: 2,
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

test("gasto sano, sin quema y cobros limpios queda en verde", () => {
  const score = computeClienteScore(base());
  assert.equal(score.verdict, "green");
  assert.ok((score.score ?? 100) <= 29);
});

test("quema crítica y cobros fallidos suben a naranja o rojo", () => {
  const score = computeClienteScore(
    base({
      avgCtr: 0.15,
      clicks: 400,
      conversions: 0,
      impressions: 20000,
      spend7d: 90,
      warnKinds: ["low_ctr"],
      burnStatus: "critical",
      pacingLabel: "acelerando",
      failedPayments45d: 3,
      paymentIntents45d: 4,
      openTickets: 3,
    }),
  );
  assert.ok(score.verdict === "orange" || score.verdict === "red");
  assert.ok((score.score ?? 0) >= 60);
  const credit = score.factors.find((f) => f.id === "credit");
  assert.equal(credit?.note, "credit_risk");
});

test("si no se leen cobros, el score sigue saliendo del resto", () => {
  const score = computeClienteScore(
    base({ failedPayments45d: null, paymentIntents45d: null }),
  );
  assert.notEqual(score.score, null);
  assert.equal(
    score.factors.find((f) => f.id === "collections")?.note,
    "collections_unknown",
  );
});
