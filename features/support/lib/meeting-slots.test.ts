import assert from "node:assert/strict";
import test from "node:test";
import {
  SEEDED_ADVISORS,
  buildAvailability,
  coverageKind,
  limaParts,
  limaWallToUtc,
  slotIsOpen,
} from "./meeting-slots.ts";

const now = new Date("2026-09-26T12:00:00.000Z");

test("el sábado 26 a las 10 hay cupo de Annie y Sebas", () => {
  const grid = buildAvailability({
    schedules: SEEDED_ADVISORS,
    busy: [],
    now,
    fromYmd: "2026-09-26",
    dayCount: 1,
  });
  const ten = grid.cells.find((cell) => cell.minute === 10 * 60);
  assert.equal(ten?.kind, "free");
  assert.equal(ten?.slots.length, 2);
  const first = ten?.slots[0];
  assert.ok(first);
  assert.equal(limaParts(new Date(first.startsAt)).minuteOfDay, 10 * 60);
  assert.equal(limaParts(new Date(first.startsAt)).ymd, "2026-09-26");
});

test("el sábado a las 9 solo cubre Annie y el domingo no hay equipo", () => {
  const saturday = buildAvailability({
    schedules: SEEDED_ADVISORS,
    busy: [],
    now,
    fromYmd: "2026-09-26",
    dayCount: 1,
  });
  const nine = saturday.cells.find((cell) => cell.minute === 9 * 60);
  assert.equal(nine?.slots.length, 2);

  const sunday = buildAvailability({
    schedules: SEEDED_ADVISORS,
    busy: [],
    now,
    fromYmd: "2026-09-27",
    dayCount: 1,
  });
  assert.ok(sunday.cells.every((cell) => cell.kind === "off"));
});

test("dos reuniones sin asesor llenan el bloque de las 10", () => {
  const start = limaWallToUtc(2026, 9, 26, 10 * 60);
  const busy = [0, 1].map(() => ({
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
    advisorEmail: null,
    status: "pending",
  }));
  const grid = buildAvailability({
    schedules: SEEDED_ADVISORS,
    busy,
    now,
    fromYmd: "2026-09-26",
    dayCount: 1,
  });
  const ten = grid.cells.find((cell) => cell.minute === 10 * 60);
  assert.equal(ten?.slots.some((slot) => slot.minute === 10 * 60), false);
  const half = ten?.slots.find((slot) => slot.minute === 10 * 60 + 30);
  assert.ok(half);
  assert.equal(slotIsOpen(grid.cells, half.startsAt)?.minute, 10 * 60 + 30);
});

test("una reunión sin asesor no bloquea el calendario de una sola persona", () => {
  const start = limaWallToUtc(2026, 9, 26, 10 * 60);
  const grid = buildAvailability({
    schedules: [SEEDED_ADVISORS[1]],
    busy: [
      {
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
        advisorEmail: null,
        status: "pending",
      },
    ],
    now,
    fromYmd: "2026-09-26",
    dayCount: 1,
  });
  const ten = grid.cells.find((cell) => cell.minute === 10 * 60);
  assert.equal(ten?.slots.some((slot) => slot.minute === 10 * 60), true);
});

test("el sábado el horario de Branlyn no tiene cupo", () => {
  const grid = buildAvailability({
    schedules: [SEEDED_ADVISORS[0]],
    busy: [],
    now,
    fromYmd: "2026-09-26",
    dayCount: 1,
  });
  assert.ok(grid.cells.every((cell) => cell.kind === "off" && cell.slots.length === 0));
});

test("el descanso de mediodía no se puede reservar", () => {
  const branlyn = SEEDED_ADVISORS[0];
  assert.equal(coverageKind(branlyn, 0, 12 * 60, 30), "break");
  assert.equal(coverageKind(branlyn, 0, 13 * 60, 30), "work");
  assert.equal(coverageKind(branlyn, 5, 10 * 60, 30), "off");
});
