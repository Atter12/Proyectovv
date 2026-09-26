import assert from "node:assert/strict";
import test from "node:test";
import {
  answerAssistant,
  cobranzaBand,
  type AssistantBrief,
  type AssistantCliente,
} from "./assistant-answer.ts";

function row(partial: Partial<AssistantCliente> & Pick<AssistantCliente, "name">): AssistantCliente {
  return {
    agency: false,
    rango: null,
    spendToday: 0,
    paidToday: 0,
    cargoMonth: 0,
    paidMonth: 0,
    debt: 0,
    band: "idle",
    paid90: 0,
    recharge7d: 0,
    fee7d: 0,
    lastCobro: null,
    ...partial,
  };
}

const brief: AssistantBrief = {
  today: "2026-09-26",
  monthLabel: "Setiembre de 2026",
  pagosHoy: [{ name: "Luis Oropeza", amount: 120 }],
  pagosHoyTotal: 120,
  activosHoy: [{ name: "Branlyn Lopez", spend: 40 }],
  rojos: [
    row({
      name: "Dante Rivera",
      cargoMonth: 400,
      paidMonth: 20,
      debt: 380,
      band: "red",
      rango: "roja",
    }),
  ],
  credito: [
    row({
      name: "Branlyn Lopez",
      agency: true,
      cargoMonth: 80,
      paidMonth: 70,
      debt: 10,
      band: "green",
    }),
  ],
  alertas: ["1 en rojo. El más alto: Dante Rivera."],
  clientes: [
    row({
      name: "Dante Rivera",
      cargoMonth: 400,
      paidMonth: 20,
      debt: 380,
      band: "red",
    }),
    row({
      name: "Branlyn Lopez",
      agency: true,
      cargoMonth: 80,
      paidMonth: 70,
      debt: 10,
      band: "green",
      spendToday: 40,
      paid90: 400,
      recharge7d: 100,
      fee7d: 10,
      lastCobro: "2026-09-25 · $100.00 · Yape",
    }),
  ],
  pendingVouchers: 1,
  recarga7d: {
    from: "2026-09-20",
    to: "2026-09-26",
    count: 56,
    creditUsd: 6781.73,
    feeUsd: 735.77,
  },
};

test("rango roja es score rojo", () => {
  assert.equal(cobranzaBand({ rango: "Roja", cargo: 10, paid: 10 }), "red");
});

test("deuda cubierta es verde", () => {
  assert.equal(cobranzaBand({ rango: null, cargo: 100, paid: 95 }), "green");
});

test("pagos de hoy nombra el cobro", () => {
  const text = answerAssistant(brief, "dame los pagos de hoy");
  assert.match(text, /Luis Oropeza/);
  assert.match(text, /120/);
});

test("score de un cliente usa el historial", () => {
  const text = answerAssistant(brief, "score de Branlyn Lopez");
  assert.match(text, /Branlyn Lopez/);
  assert.match(text, /verde/);
  assert.match(text, /90 días/);
  assert.match(text, /fee/);
  assert.doesNotMatch(text, /Dante/);
});

test("la semana separa recarga y fee", () => {
  const text = answerAssistant(brief, "estos 7 dias cuanto recargaron, recarga y fee");
  assert.match(text, /6,781\.73/);
  assert.match(text, /735\.77/);
  assert.doesNotMatch(text, /Luis Oropeza/);
});
