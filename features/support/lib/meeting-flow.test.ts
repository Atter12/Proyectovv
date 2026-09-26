import assert from "node:assert/strict";
import test from "node:test";
import {
  SEEDED_ADVISORS,
  buildAvailability,
  limaWallToUtc,
  slotIsOpen,
  type AdvisorSchedule,
  type BusySpan,
  type MeetingStatus,
} from "./meeting-slots.ts";
import {
  CREATED_MEETING_STATUS,
  MeetingFlowError,
  occupiesSlot,
  planClientMutation,
  planStaffMutation,
} from "./meeting-flow.ts";

const now = new Date("2026-09-26T12:00:00.000Z");
const annie = SEEDED_ADVISORS[1];
const sebas = SEEDED_ADVISORS[3];
const ten = limaWallToUtc(2026, 9, 26, 10 * 60);
const tenThirty = limaWallToUtc(2026, 9, 26, 10 * 60 + 30);

type Apt = {
  id: string;
  status: MeetingStatus;
  advisor: AdvisorSchedule;
  startsAt: string;
  endsAt: string;
  meetUrl: string | null;
};

function busyOf(apts: Apt[], ignoreId?: string): BusySpan[] {
  return apts
    .filter((apt) => apt.id !== ignoreId && occupiesSlot(apt.status))
    .map((apt) => ({
      startsAt: apt.startsAt,
      endsAt: apt.endsAt,
      advisorEmail: apt.advisor.email,
      status: apt.status,
    }));
}

function isFree(advisor: AdvisorSchedule, startsAt: Date, apts: Apt[], ignoreId?: string) {
  const grid = buildAvailability({
    schedules: [advisor],
    busy: busyOf(apts, ignoreId),
    now,
    fromYmd: "2026-09-26",
    dayCount: 1,
  });
  return Boolean(slotIsOpen(grid.cells, startsAt.toISOString()));
}

function book(apts: Apt[], advisor: AdvisorSchedule, startsAt: Date): Apt {
  assert.equal(isFree(advisor, startsAt, apts), true);
  const apt: Apt = {
    id: `m-${apts.length + 1}`,
    status: CREATED_MEETING_STATUS,
    advisor,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
    meetUrl: null,
  };
  apts.push(apt);
  return apt;
}

function clientAct(apt: Apt, action: string, apts: Apt[], nextStart?: Date) {
  const plan = planClientMutation({
    status: apt.status,
    startsAtMs: Date.parse(apt.startsAt),
    action,
    now: now.getTime(),
  });
  if (action === "reschedule") {
    assert.ok(nextStart);
    assert.equal(isFree(apt.advisor, nextStart, apts, apt.id), true);
    apt.startsAt = nextStart.toISOString();
    apt.endsAt = new Date(nextStart.getTime() + 30 * 60_000).toISOString();
  }
  apt.status = plan.status;
  if (plan.clearMeetUrl) apt.meetUrl = null;
  return plan;
}

function staffAct(apt: Apt, action: string, meetUrl?: string) {
  const nextUrl = meetUrl ?? apt.meetUrl ?? "";
  const plan = planStaffMutation({
    status: apt.status,
    action,
    hasMeetUrl: nextUrl.startsWith("https://"),
  });
  if (plan.kind === "schedule" || plan.kind === "close") apt.status = plan.status;
  if (plan.kind === "schedule") apt.meetUrl = nextUrl;
  return plan;
}

test("agendar deja la cita pendiente y ocupa solo a esa persona", () => {
  const apts: Apt[] = [];
  const mine = book(apts, annie, ten);
  assert.equal(mine.status, "pending");
  assert.equal(mine.meetUrl, null);
  assert.equal(isFree(annie, ten, apts), false);
  const other = book(apts, sebas, ten);
  assert.equal(other.status, "pending");
  assert.equal(isFree(annie, ten, apts), false);
  assert.throws(() => book(apts, annie, ten), /false/);
});

test("cancelar libera el horario y una cita cerrada no vuelve atrás", () => {
  const apts: Apt[] = [];
  const mine = book(apts, annie, ten);
  clientAct(mine, "cancel", apts);
  assert.equal(mine.status, "cancelled");
  assert.equal(occupiesSlot(mine.status), false);
  assert.equal(isFree(annie, ten, apts), true);

  assert.throws(
    () => clientAct(mine, "reschedule", apts, tenThirty),
    (error: MeetingFlowError) => error.code === "terminal",
  );
  staffAct(book(apts, annie, ten), "confirm", "https://meet.google.com/abc");
  const confirmed = apts[1];
  staffAct(confirmed, "complete");
  assert.equal(confirmed.status, "completed");
  assert.equal(isFree(annie, ten, apts), true);
  assert.throws(
    () => staffAct(confirmed, "confirm", "https://meet.google.com/abc"),
    (error: MeetingFlowError) => error.code === "terminal",
  );
  assert.equal(planStaffMutation({ status: "completed", action: "notes", hasMeetUrl: false }).kind, "notes");
});

test("el cliente que reprograma vuelve a pendiente y suelta el horario anterior", () => {
  const apts: Apt[] = [];
  const mine = book(apts, annie, ten);
  staffAct(mine, "confirm", "https://meet.google.com/abc");
  assert.equal(mine.status, "confirmed");
  const plan = clientAct(mine, "reschedule", apts, tenThirty);
  assert.equal(plan.status, "pending");
  assert.equal(plan.clearMeetUrl, true);
  assert.equal(plan.clearReminders, true);
  assert.equal(mine.meetUrl, null);
  assert.equal(mine.status, "pending");
  assert.equal(isFree(annie, ten, apts), true);
  assert.equal(isFree(annie, tenThirty, apts), false);
});

test("soporte confirma con enlace y, si mueve la cita, queda reprogramada", () => {
  const apts: Apt[] = [];
  const mine = book(apts, annie, ten);
  assert.throws(
    () => staffAct(mine, "confirm"),
    (error: MeetingFlowError) => error.code === "meet_url",
  );
  assert.equal(mine.status, "pending");
  staffAct(mine, "confirm", "https://meet.google.com/abc");
  assert.equal(mine.status, "confirmed");
  assert.equal(mine.meetUrl, "https://meet.google.com/abc");
  assert.equal(isFree(annie, ten, apts), false);

  const moved = staffAct(mine, "reschedule", "https://meet.google.com/abc");
  assert.equal(moved.kind, "schedule");
  assert.equal(mine.status, "rescheduled");
  staffAct(mine, "no_show");
  assert.equal(mine.status, "no_show");
  assert.equal(occupiesSlot(mine.status), false);
});

test("una cita que ya empezó no se cancela y el cliente no confirma", () => {
  assert.throws(
    () =>
      planClientMutation({
        status: "confirmed",
        startsAtMs: now.getTime() - 1000,
        action: "cancel",
        now: now.getTime(),
      }),
    (error: MeetingFlowError) => error.code === "started",
  );
  assert.throws(
    () =>
      planClientMutation({
        status: "pending",
        startsAtMs: ten.getTime(),
        action: "confirm",
        now: now.getTime(),
      }),
    (error: MeetingFlowError) => error.code === "invalid",
  );
  assert.equal(
    planStaffMutation({ status: "pending", action: "remind", hasMeetUrl: false }).kind,
    "remind",
  );
});
