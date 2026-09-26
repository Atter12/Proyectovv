import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAllianceBoard,
  buildMonthGrid,
  planAllianceAlerts,
  type FollowupAlliance,
} from "./followup.ts";

const today = "2026-09-26";
const contractId = "11111111-1111-4111-8111-111111111111";

function alliance(overrides: Partial<FollowupAlliance> = {}): FollowupAlliance {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Ecommerce X",
    allianceType: "ecommerce",
    status: "active",
    ownerName: "Juan Pérez",
    createdOn: "2026-09-02",
    contracts: [
      {
        id: contractId,
        contractType: "commercial",
        version: 1,
        status: "signed",
        expiresOn: "2026-10-16",
        sentOn: "2026-08-01",
        createdOn: "2026-08-01",
      },
    ],
    reminders: [],
    ...overrides,
  };
}

test("a 20 días abre la alerta de 30 y no repite una ya cerrada", () => {
  const first = planAllianceAlerts([alliance()], today);
  assert.equal(first.create.length, 1);
  assert.equal(first.create[0]?.sourceKey, `expiry:${contractId}:30`);
  assert.equal(first.create[0]?.dueOn, today);
  assert.equal(first.create[0]?.priority, "normal");

  const again = planAllianceAlerts(
    [
      alliance({
        reminders: [
          {
            id: "r1",
            title: "Vence en 30 días",
            dueOn: today,
            priority: "normal",
            status: "done",
            ownerName: "Juan Pérez",
            sourceKey: `expiry:${contractId}:30`,
          },
        ],
      }),
    ],
    today,
  );
  assert.equal(again.create.length, 0);
});

test("a 10 días pasa a la alerta de 15 y cierra la de 30", () => {
  const plan = planAllianceAlerts(
    [
      alliance({
        contracts: [{ ...alliance().contracts[0], expiresOn: "2026-10-06" }],
        reminders: [
          {
            id: "r1",
            title: "Vence en 30 días",
            dueOn: "2026-09-16",
            priority: "normal",
            status: "open",
            ownerName: "Juan Pérez",
            sourceKey: `expiry:${contractId}:30`,
          },
        ],
      }),
    ],
    today,
  );
  assert.equal(plan.create[0]?.sourceKey, `expiry:${contractId}:15`);
  assert.equal(plan.create[0]?.priority, "high");
  assert.deepEqual(plan.completeKeys, [`expiry:${contractId}:30`]);
});

test("una firma quieta una semana genera una sola alerta vencida", () => {
  const waiting = planAllianceAlerts(
    [
      alliance({
        contracts: [
          {
            id: contractId,
            contractType: "commercial",
            version: 2,
            status: "pending_signature",
            expiresOn: null,
            sentOn: "2026-09-10",
            createdOn: "2026-09-10",
          },
        ],
      }),
    ],
    today,
  );
  assert.equal(waiting.create[0]?.sourceKey, `signature:${contractId}`);
  assert.equal(waiting.create[0]?.dueOn, "2026-09-17");
  assert.match(waiting.create[0]?.title ?? "", /hace 16 días/);

  const recent = planAllianceAlerts(
    [
      alliance({
        contracts: [
          {
            id: contractId,
            contractType: "commercial",
            version: 2,
            status: "pending_signature",
            expiresOn: null,
            sentOn: "2026-09-25",
            createdOn: "2026-09-25",
          },
        ],
      }),
    ],
    today,
  );
  assert.equal(recent.create.length, 0);
});

test("firmar o terminar la alianza cierra las alertas abiertas", () => {
  const open = {
    id: "r1",
    title: "Firma pendiente",
    dueOn: "2026-09-17",
    priority: "high" as const,
    status: "open" as const,
    ownerName: "Juan Pérez",
    sourceKey: `signature:${contractId}`,
  };
  const signed = planAllianceAlerts(
    [alliance({ contracts: [{ ...alliance().contracts[0], status: "signed", expiresOn: "2027-01-01" }], reminders: [open] })],
    today,
  );
  assert.deepEqual(signed.completeKeys, [`signature:${contractId}`]);
  assert.equal(signed.create.length, 0);

  const ended = planAllianceAlerts([alliance({ status: "ended", reminders: [open] })], today);
  assert.deepEqual(ended.completeKeys, [`signature:${contractId}`]);
  assert.equal(ended.create.length, 0);
});

test("el tablero cuenta el mes, los vencimientos y el responsable atrasado", () => {
  const board = buildAllianceBoard(
    [
      alliance({
        reminders: [
          {
            id: "late",
            title: "Llamar",
            dueOn: "2026-09-25",
            priority: "high",
            status: "open",
            ownerName: "Ana",
            sourceKey: "",
          },
        ],
        contracts: [
          alliance().contracts[0],
          {
            id: "33333333-3333-4333-8333-333333333333",
            contractType: "renewal",
            version: 1,
            status: "draft",
            expiresOn: null,
            sentOn: null,
            createdOn: "2026-09-20",
          },
        ],
      }),
      alliance({
        id: "44444444-4444-4444-8444-444444444444",
        name: "Agencia vieja",
        allianceType: "agency",
        status: "ended",
        createdOn: "2026-08-01",
        contracts: [],
        reminders: [],
      }),
    ],
    today,
  );
  assert.equal(board.stats.newThisMonth, 1);
  assert.equal(board.stats.expiring, 1);
  assert.equal(board.stats.pendingRenewals, 1);
  assert.equal(board.stats.overdueFollowUps, 1);
  assert.equal(board.owners[0]?.name, "Ana");
  assert.equal(board.byType.find((item) => item.type === "ecommerce")?.count, 1);
  assert.equal(board.byType.find((item) => item.type === "agency")?.count, 0);
});

test("septiembre 2026 empieza el martes en la grilla", () => {
  const grid = buildMonthGrid("2026-09");
  assert.equal(grid.length, 42);
  assert.equal(grid[0]?.date, "2026-08-31");
  assert.equal(grid[1]?.date, "2026-09-01");
  assert.equal(grid[1]?.inMonth, true);
  assert.equal(grid[0]?.inMonth, false);
});
