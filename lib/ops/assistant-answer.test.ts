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
    }),
  ],
  pendingVouchers: 1,
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

test("score de un cliente no inventa otro", () => {
  const text = answerAssistant(brief, "score de Branlyn Lopez");
  assert.match(text, /Branlyn Lopez/);
  assert.match(text, /verde/);
  assert.doesNotMatch(text, /Dante/);
});
