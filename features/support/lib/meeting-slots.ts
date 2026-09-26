/** Horarios de reuniones de soporte en America/Lima (sin horario de verano). */

export const LIMA_TZ = "America/Lima";
export const SLOT_MINUTES = 30;
export const LEAD_MS = 2 * 60 * 60 * 1000;
export const HORIZON_DAYS = 14;
export const MAX_OPEN_MEETINGS = 3;
export const GRID_START_MINUTE = 8 * 60;
export const GRID_END_MINUTE = 19 * 60;

export const MEETING_TYPES = [
  "consulta",
  "onboarding",
  "revision",
  "estrategia",
  "seguimiento",
  "soporte",
] as const;

export const MEETING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "rescheduled",
  "cancelled",
  "no_show",
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number];
export type MeetingStatus = (typeof MEETING_STATUSES)[number];
export type HourKind = "free" | "break" | "full" | "off";

const ACTIVE_STATUSES = new Set<string>(["pending", "confirmed", "rescheduled"]);

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export type AdvisorSchedule = {
  email: string;
  displayName: string;
  weekdayMask: number;
  startMinute: number;
  endMinute: number;
  breakStartMinute: number;
  breakEndMinute: number;
  isAvailable: boolean;
};

export type BusySpan = {
  startsAt: string;
  endsAt: string;
  advisorEmail: string | null;
  status: string;
};

export type FreeSlot = {
  startsAt: string;
  endsAt: string;
  minute: number;
};

export type HourCell = {
  day: string;
  minute: number;
  kind: HourKind;
  slots: FreeSlot[];
};

export const SEEDED_ADVISORS: AdvisorSchedule[] = [
  {
    email: "branlyn.lopez.r@gmail.com",
    displayName: "Branlyn",
    weekdayMask: 31,
    startMinute: 8 * 60,
    endMinute: 17 * 60,
    breakStartMinute: 12 * 60,
    breakEndMinute: 13 * 60,
    isAvailable: true,
  },
  {
    email: "anniealejandrova6@gmail.com",
    displayName: "Annie",
    weekdayMask: 63,
    startMinute: 9 * 60,
    endMinute: 18 * 60,
    breakStartMinute: 13 * 60,
    breakEndMinute: 14 * 60,
    isAvailable: true,
  },
  {
    email: "freddyjgt258@gmail.com",
    displayName: "Freddy",
    weekdayMask: 31,
    startMinute: 8 * 60,
    endMinute: 17 * 60,
    breakStartMinute: 13 * 60,
    breakEndMinute: 14 * 60,
    isAvailable: true,
  },
  {
    email: "sebasnodeal@gmail.com",
    displayName: "Sebas",
    weekdayMask: 63,
    startMinute: 10 * 60,
    endMinute: 19 * 60,
    breakStartMinute: 14 * 60,
    breakEndMinute: 15 * 60,
    isAvailable: true,
  },
];

export function defaultAdvisor(email: string, displayName: string): AdvisorSchedule {
  return {
    email,
    displayName,
    weekdayMask: 31,
    startMinute: 9 * 60,
    endMinute: 18 * 60,
    breakStartMinute: 13 * 60,
    breakEndMinute: 14 * 60,
    isAvailable: true,
  };
}

export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function weekdayLabel(mask: number): string {
  if (mask === 31) return "Lun – Vie";
  if (mask === 63) return "Lun – Sáb";
  if (mask === 127) return "Lun – Dom";
  const names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const picked = names.filter((_, index) => (mask & (1 << index)) !== 0);
  return picked.length > 0 ? picked.join(", ") : "Sin días";
}

type LimaParts = {
  year: number;
  month: number;
  day: number;
  weekdayMon0: number;
  ymd: string;
  minuteOfDay: number;
};

export function limaParts(date: Date): LimaParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const minute = Number(bag.minute);
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    weekdayMon0: WEEKDAY_INDEX[bag.weekday] ?? 0,
    ymd: `${bag.year}-${bag.month}-${bag.day}`,
    minuteOfDay: hour * 60 + minute,
  };
}

/** Interpreta pared horaria de Lima como instante UTC. */
export function limaWallToUtc(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
): Date {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute, 0, 0));
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const noon = limaWallToUtc(year, month, day, 12 * 60);
  return limaParts(new Date(noon.getTime() + days * 86_400_000)).ymd;
}

export function mondayOf(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const weekday = limaParts(limaWallToUtc(year, month, day, 12 * 60)).weekdayMon0;
  return addDaysYmd(ymd, -weekday);
}

export function todayYmd(now = new Date()): string {
  return limaParts(now).ymd;
}

export type Coverage = "off" | "break" | "work";

export function coverageKind(
  schedule: AdvisorSchedule,
  weekdayMon0: number,
  minute: number,
  duration: number,
): Coverage {
  if (!schedule.isAvailable) return "off";
  if ((schedule.weekdayMask & (1 << weekdayMon0)) === 0) return "off";
  const end = minute + duration;
  if (minute < schedule.startMinute || end > schedule.endMinute) return "off";
  const overlapsBreak =
    minute < schedule.breakEndMinute && end > schedule.breakStartMinute;
  if (overlapsBreak) return "break";
  return "work";
}

function parseYmd(ymd: string): [number, number, number] {
  const [year, month, day] = ymd.split("-").map(Number);
  return [year, month, day];
}

export function buildAvailability(input: {
  schedules: AdvisorSchedule[];
  busy: BusySpan[];
  now: Date;
  fromYmd: string;
  dayCount: number;
  leadMs?: number;
  slotMinutes?: number;
}): { days: string[]; hours: number[]; cells: HourCell[] } {
  const slotMinutes = input.slotMinutes ?? SLOT_MINUTES;
  const leadMs = input.leadMs ?? LEAD_MS;
  const earliest = input.now.getTime() + leadMs;
  const days: string[] = [];
  for (let index = 0; index < input.dayCount; index += 1) {
    days.push(addDaysYmd(input.fromYmd, index));
  }
  const hours: number[] = [];
  for (let minute = GRID_START_MINUTE; minute < GRID_END_MINUTE; minute += 60) {
    hours.push(minute);
  }

  const lastDay = addDaysYmd(limaParts(input.now).ymd, HORIZON_DAYS);
  const cells: HourCell[] = [];
  for (const day of days) {
    if (day > lastDay) {
      for (const hour of hours) {
        cells.push({ day, minute: hour, kind: "off", slots: [] });
      }
      continue;
    }
    const [year, month, date] = parseYmd(day);
    const weekday = limaParts(limaWallToUtc(year, month, date, 12 * 60)).weekdayMon0;
    for (const hour of hours) {
      const slots: FreeSlot[] = [];
      let sawBreak = false;
      let sawWork = false;
      let sawFull = false;
      for (const offset of [0, slotMinutes]) {
        const minute = hour + offset;
        if (minute >= GRID_END_MINUTE) continue;
        const start = limaWallToUtc(year, month, date, minute);
        const endMs = start.getTime() + slotMinutes * 60_000;
        const covering: string[] = [];
        for (const schedule of input.schedules) {
          const kind = coverageKind(schedule, weekday, minute, slotMinutes);
          if (kind === "break") sawBreak = true;
          if (kind === "work") {
            sawWork = true;
            covering.push(schedule.email);
          }
        }
        const overlapping = input.busy.filter((span) => {
          if (!ACTIVE_STATUSES.has(span.status)) return false;
          const busyStart = Date.parse(span.startsAt);
          const busyEnd = Date.parse(span.endsAt);
          return busyStart < endMs && busyEnd > start.getTime();
        });
        const taken = new Set(
          overlapping
            .map((span) => span.advisorEmail)
            .filter((email): email is string => typeof email === "string" && covering.includes(email)),
        );
        const unassigned = overlapping.filter((span) => {
          const email = span.advisorEmail;
          return !email || !covering.includes(email);
        }).length;
        const free = covering.filter((email) => !taken.has(email)).length - unassigned;
        if (free > 0 && start.getTime() >= earliest) {
          slots.push({
            startsAt: start.toISOString(),
            endsAt: new Date(endMs).toISOString(),
            minute,
          });
        } else if (covering.length > 0 && start.getTime() >= earliest && free <= 0) {
          sawFull = true;
        }
      }
      let kind: HourKind = "off";
      if (sawBreak && !sawWork) kind = "break";
      if (sawFull) kind = "full";
      if (slots.length > 0) kind = "free";
      cells.push({ day, minute: hour, kind, slots });
    }
  }

  return { days, hours, cells };
}

export function slotIsOpen(
  cells: HourCell[],
  startsAt: string,
): FreeSlot | null {
  const target = Date.parse(startsAt);
  if (Number.isNaN(target)) return null;
  for (const cell of cells) {
    const slot = cell.slots.find((item) => Date.parse(item.startsAt) === target);
    if (slot) return slot;
  }
  return null;
}

export function isMeetingType(value: string): value is MeetingType {
  return (MEETING_TYPES as readonly string[]).includes(value);
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function limaDayBounds(now = new Date()): { start: Date; end: Date } {
  const parts = limaParts(now);
  const start = limaWallToUtc(parts.year, parts.month, parts.day, 0);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}
