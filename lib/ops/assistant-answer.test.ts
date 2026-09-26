import assert from "node:assert/strict";
import test from "node:test";
import {
  answerAssistant,
  buildAssistantResponse,
  cobranzaBand,
  money,
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
  assert.match(text, /score usa el cargo y los cobros del mes, junto con el rango de cobranza/);
  assert.match(text, /Los cobros de 90 días y las recargas de la semana se muestran como historial/);
  assert.doesNotMatch(text, /Dante/);
});

test("la semana separa recarga y fee", () => {
  const text = answerAssistant(brief, "estos 7 dias cuanto recargaron, recarga y fee");
  assert.match(text, /6,781\.73/);
  assert.match(text, /735\.77/);
  assert.doesNotMatch(text, /Luis Oropeza/);
});

test("pagos estructurados cuentan clientes y mantienen el total del corte", () => {
  const response = buildAssistantResponse(brief, "pagos de hoy");
  assert.equal(response.reply, answerAssistant(brief, "pagos de hoy"));
  assert.equal(response.today, brief.today);
  assert.equal(response.blocks.length, 1);
  const payments = response.blocks[0];
  assert.equal(payments.id, "payments");
  assert.deepEqual(payments.metrics, [
    { label: "Total cobrado", value: money(120) },
    { label: "Clientes con pagos", value: "1" },
  ]);
  assert.deepEqual(payments.table?.rows, [{ name: "Luis Oropeza", amount: money(120) }]);
  assert.equal(payments.sources[0].label, "Hecom · Cobros");
  assert.match(payments.sources[0].detail, /2026-09-26.*agrupados por cliente/);
  assert.doesNotMatch(JSON.stringify(payments), /transacciones|método|hora/i);
});

test("tablas truncadas conservan el conteo y el total de todos los clientes", () => {
  const payments = Array.from({ length: 18 }, (_, i) => ({ name: `Cliente ${i + 1}`, amount: 10 }));
  const response = buildAssistantResponse({ ...brief, pagosHoy: payments, pagosHoyTotal: 180 }, "pagos hoy");
  assert.equal(response.blocks[0].table?.rows.length, 15);
  assert.deepEqual(response.blocks[0].metrics, [
    { label: "Total cobrado", value: money(180) },
    { label: "Clientes con pagos", value: "18" },
  ]);
  assert.match(response.blocks[0].table?.caption ?? "", /15 de 18 clientes/);
});

test("el reporte semanal atribuye recargas a AdsHolistic y no mezcla cobros de Hecom", () => {
  const response = buildAssistantResponse(brief, "recarga y fee de esta semana");
  assert.deepEqual(response.blocks.map((block) => block.id), ["week"]);
  assert.deepEqual(response.blocks[0].metrics, [
    { label: "Recarga a cartera", value: money(6781.73) },
    { label: "Fee de recarga", value: money(735.77) },
    { label: "Total cobrado", value: money(7517.5) },
  ]);
  assert.match(response.blocks[0].text, /56 recargas.*2026-09-20.*2026-09-26/);
  assert.equal(response.blocks[0].sources[0].label, "AdsHolistic · Recargas");
  assert.doesNotMatch(JSON.stringify(response.blocks), /Luis Oropeza/);
});

test("consultas compuestas conservan pagos, actividad, alertas, crédito y rojos", () => {
  const response = buildAssistantResponse(brief, "pagos de hoy, activos, alertas, crédito y clientes en rojo");
  assert.deepEqual(response.blocks.map((block) => block.id), ["payments", "active", "alerts", "credit", "red"]);
  const active = response.blocks[1];
  assert.deepEqual(active.table?.rows, [{ name: "Branlyn Lopez", spend: money(40) }]);
  assert.match(active.sources[0].detail, /incluido el fee/);
  assert.equal(response.blocks[2].metrics?.find((metric) => metric.label === "Vouchers pendientes")?.value, "1");
  assert.equal(response.blocks[2].table?.rows[0].alert, brief.alertas[0]);
  assert.ok(response.blocks[2].sources.some((source) => source.label === "AdsHolistic · Pagos manuales"));
  assert.equal(response.blocks[3].table?.rows[0].name, "Branlyn Lopez");
  assert.equal(response.blocks[4].table?.rows[0].debt, money(380));
});

test("una consulta semanal también conserva otros temas pedidos", () => {
  const response = buildAssistantResponse(brief, "recarga de esta semana y alertas");
  assert.deepEqual(response.blocks.map((block) => block.id), ["week", "alerts"]);
});

test("actividad y deuda totalizan toda la población del corte aunque la tabla sea limitada", () => {
  const activosHoy = Array.from({ length: 17 }, (_, i) => ({ name: `Activo ${i}`, spend: 2.5 }));
  const rojos = Array.from({ length: 14 }, (_, i) => row({ name: `Rojo ${i}`, debt: 201, band: "red" }));
  const response = buildAssistantResponse({ ...brief, activosHoy, rojos }, "activos y clientes en rojo");
  const [activity, debt] = response.blocks;
  assert.equal(activity.table?.rows.length, 15);
  assert.deepEqual(activity.metrics, [
    { label: "Clientes activos", value: "17" },
    { label: "Cargo de clientes activos", value: money(42.5) },
  ]);
  assert.equal(debt.table?.rows.length, 12);
  assert.deepEqual(debt.metrics, [
    { label: "Clientes en rojo", value: "14" },
    { label: "Deuda de clientes en rojo", value: money(2814) },
  ]);
});

test("score por nombre usa solo los datos del cliente y el historial real", () => {
  const response = buildAssistantResponse(brief, "cómo está BRANLYN LÓPEZ, score y deuda");
  assert.deepEqual(response.blocks.map((block) => block.id), ["client"]);
  const client = response.blocks[0];
  assert.equal(client.title, "Branlyn Lopez");
  assert.equal(client.metrics?.find((metric) => metric.label === "Deuda del mes")?.value, money(10));
  assert.equal(client.table?.rows.find((row) => row.concept === "Cobrado en los últimos 90 días")?.amount, money(400));
  assert.match(client.text, /Último cobro: 2026-09-25/);
  assert.match(client.text, /cargo, los cobros del mes y el rango/);
  assert.deepEqual(client.sources.map((source) => source.label), ["Hecom · Cartera", "AdsHolistic · Recargas"]);
  assert.doesNotMatch(JSON.stringify(response), /Dante/);
});

test("un nombre sin intención explícita devuelve el cliente y el nombre más largo gana", () => {
  const extended = { ...brief, clientes: [row({ name: "Branlyn" }), ...brief.clientes] };
  const response = buildAssistantResponse(extended, "Branlyn Lopez");
  assert.equal(response.blocks[0].id, "client");
  assert.equal(response.blocks[0].title, "Branlyn Lopez");
});

test("cortes vacíos muestran ceros sin inventar filas", () => {
  const empty: AssistantBrief = {
    ...brief,
    pagosHoy: [],
    pagosHoyTotal: 0,
    activosHoy: [],
    rojos: [],
    credito: [],
    alertas: [],
    clientes: [],
    pendingVouchers: 0,
    recarga7d: { ...brief.recarga7d, count: 0, creditUsd: 0, feeUsd: 0 },
  };
  const response = buildAssistantResponse(empty, "pagos, activos, alertas, crédito y rojo");
  assert.equal(response.blocks.length, 5);
  assert.ok(response.blocks.every((block) => !block.table));
  assert.ok(response.blocks.flatMap((block) => block.metrics ?? []).every((metric) => ["0", money(0)].includes(metric.value)));
  assert.match(response.blocks.find((block) => block.id === "alerts")?.text ?? "", /No hay clientes en rojo/);
  const week = buildAssistantResponse(empty, "recargas de la semana").blocks[0];
  assert.match(week.text, /0 recargas/);
  assert.ok(week.metrics?.every((metric) => metric.value === money(0)));
  const client = buildAssistantResponse({ ...empty, clientes: [row({ name: "Cliente Vacío" })] }, "Cliente Vacío").blocks[0];
  assert.match(client.text, /Sin cobros registrados/);
  assert.ok(client.table?.rows.every((item) => item.amount === money(0)));
});

test("preguntas vacías o desconocidas muestran ayuda sin cifras ni fuentes inventadas", () => {
  for (const question of ["", " ", "muéstrame campañas de ayer"]) {
    const response = buildAssistantResponse(brief, question);
    assert.equal(response.reply, answerAssistant(brief, question));
    assert.equal(response.blocks[0].id, "help");
    assert.equal(response.blocks[0].metrics, undefined);
    assert.equal(response.blocks[0].table, undefined);
    assert.deepEqual(response.blocks[0].sources, []);
  }
});
