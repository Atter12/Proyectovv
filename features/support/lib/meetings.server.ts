import "server-only";
import { listHecomOtpStaffEmails } from "@/lib/auth/hecom-otp.server";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionUser } from "@/types/auth";
import type {
  AdvisorOption,
  MeetingCounts,
  MeetingDto,
  ScheduleDto,
} from "@/features/support/lib/meeting-types";
import {
  CREATED_MEETING_STATUS,
  MeetingFlowError,
  planClientMutation,
  planStaffMutation,
} from "@/features/support/lib/meeting-flow";
import {
  HORIZON_DAYS,
  MAX_OPEN_MEETINGS,
  MEETING_STATUSES,
  SLOT_MINUTES,
  SEEDED_ADVISORS,
  addDaysYmd,
  buildAvailability,
  coverageKind,
  defaultAdvisor,
  isHttpsUrl,
  isMeetingType,
  limaDayBounds,
  limaParts,
  mondayOf,
  slotIsOpen,
  todayYmd,
  type AdvisorSchedule,
  type BusySpan,
  type HourCell,
  type MeetingStatus,
} from "@/features/support/lib/meeting-slots";

const ACTIVE = ["pending", "confirmed", "rescheduled"] as const;

export class MeetingError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type { MeetingCounts, MeetingDto, ScheduleDto } from "@/features/support/lib/meeting-types";

type MeetingRow = {
  id: string;
  organization_id: string | null;
  requester_user_id: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  advisor_user_id: string | null;
  advisor_name: string | null;
  advisor_email: string | null;
  subject: string;
  notes: string | null;
  meeting_type: string;
  channel: string;
  meet_url: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  client_reminder_at: string | null;
  advisor_reminder_at: string | null;
  created_at: string;
};

type ScheduleRow = {
  email: string;
  user_id: string | null;
  display_name: string;
  weekday_mask: number;
  start_minute: number;
  end_minute: number;
  break_start_minute: number;
  break_end_minute: number;
  is_available: boolean;
};

const MEETING_COLUMNS =
  "id, organization_id, requester_user_id, requester_name, requester_email, requester_phone, advisor_user_id, advisor_name, advisor_email, subject, notes, meeting_type, channel, meet_url, starts_at, ends_at, status, client_reminder_at, advisor_reminder_at, created_at";

function db() {
  return createAdminClient();
}

function asMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    /support_meetings|support_advisor_schedules/.test(error.message ?? "")
  );
}

function raise(error: { code?: string; message?: string } | null, fallback: string): never {
  if (asMissingTable(error)) {
    throw new MeetingError(
      "unavailable",
      "Falta aplicar la migración de reuniones de soporte.",
    );
  }
  throw new MeetingError("invalid", error?.message || fallback);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toMeeting(row: MeetingRow): MeetingDto {
  const status = (MEETING_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as MeetingStatus)
    : "pending";
  const meetingType = isMeetingType(row.meeting_type) ? row.meeting_type : "consulta";
  return {
    id: row.id,
    subject: row.subject,
    notes: row.notes,
    meetingType,
    channel: row.channel,
    meetUrl: row.meet_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone,
    advisorName: row.advisor_name,
    advisorEmail: row.advisor_email,
    clientReminderSent: Boolean(row.client_reminder_at),
    advisorReminderSent: Boolean(row.advisor_reminder_at),
    createdAt: row.created_at,
  };
}

function toSchedule(row: ScheduleRow): ScheduleDto {
  return {
    email: row.email,
    userId: row.user_id,
    displayName: row.display_name,
    weekdayMask: row.weekday_mask,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    breakStartMinute: row.break_start_minute,
    breakEndMinute: row.break_end_minute,
    isAvailable: row.is_available,
  };
}

/** Las cuatro personas que el cliente puede elegir para reunirse. */
function bookableAdvisors(schedules: ScheduleDto[]): ScheduleDto[] {
  const seeded = new Set(SEEDED_ADVISORS.map((item) => item.email));
  return schedules.filter((item) => seeded.has(item.email) && item.isAvailable);
}

function displayNameFor(email: string): string {
  const seeded = SEEDED_ADVISORS.find((item) => item.email === email);
  if (seeded) return seeded.displayName;
  const local = email.split("@")[0] ?? email;
  const word = local.split(/[._-]/)[0] ?? local;
  return word.slice(0, 1).toUpperCase() + word.slice(1, 24);
}

export async function ensureAdvisorSchedules(): Promise<ScheduleDto[]> {
  const admin = db();
  const catalog = new Map<string, AdvisorSchedule>();
  for (const advisor of SEEDED_ADVISORS) catalog.set(advisor.email, advisor);
  for (const email of listHecomOtpStaffEmails()) {
    if (!catalog.has(email)) catalog.set(email, defaultAdvisor(email, displayNameFor(email)));
  }

  const { data: existing, error: readError } = await admin
    .from("support_advisor_schedules")
    .select("email");
  if (readError) raise(readError, "No se pudieron leer los horarios.");

  const present = new Set((existing ?? []).map((row) => String(row.email)));
  const missing = [...catalog.values()].filter((item) => !present.has(item.email));
  if (missing.length > 0) {
    const { error } = await admin.from("support_advisor_schedules").insert(
      missing.map((item) => ({
        email: item.email,
        display_name: item.displayName,
        weekday_mask: item.weekdayMask,
        start_minute: item.startMinute,
        end_minute: item.endMinute,
        break_start_minute: item.breakStartMinute,
        break_end_minute: item.breakEndMinute,
        is_available: item.isAvailable,
      })),
    );
    if (error && error.code !== "23505") raise(error, "No se pudieron crear los horarios.");
  }

  const emails = [...catalog.keys()];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("email", emails);
  for (const profile of profiles ?? []) {
    const email = String(profile.email ?? "").toLowerCase();
    const userId = String(profile.id ?? "");
    if (!email || !userId) continue;
    await admin
      .from("support_advisor_schedules")
      .update({ user_id: userId })
      .eq("email", email)
      .is("user_id", null);
  }

  const { data, error } = await admin
    .from("support_advisor_schedules")
    .select(
      "email, user_id, display_name, weekday_mask, start_minute, end_minute, break_start_minute, break_end_minute, is_available",
    )
    .order("display_name", { ascending: true });
  if (error) raise(error, "No se pudieron leer los horarios.");
  const order = new Map(SEEDED_ADVISORS.map((item, index) => [item.email, index]));
  return ((data ?? []) as ScheduleRow[])
    .map(toSchedule)
    .sort((a, b) => {
      const ao = order.get(a.email) ?? 100;
      const bo = order.get(b.email) ?? 100;
      if (ao !== bo) return ao - bo;
      return a.displayName.localeCompare(b.displayName, "es");
    });
}

async function loadBusy(ignoreId?: string | null): Promise<BusySpan[]> {
  const from = new Date(Date.now() - 86_400_000).toISOString();
  const to = new Date(Date.now() + (HORIZON_DAYS + 2) * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("support_meetings")
    .select("id, starts_at, ends_at, advisor_email, status")
    .in("status", [...ACTIVE])
    .gte("starts_at", from)
    .lte("starts_at", to);
  if (error) raise(error, "No se pudo calcular la disponibilidad.");
  return (data ?? [])
    .filter((row) => row.id !== ignoreId)
    .map((row) => ({
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      advisorEmail: row.advisor_email ? String(row.advisor_email) : null,
      status: String(row.status),
    }));
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

function overlapsSlot(span: BusySpan, startMs: number, endMs: number): boolean {
  return Date.parse(span.startsAt) < endMs && Date.parse(span.endsAt) > startMs;
}

/** Asesores que trabajan ese bloque y no tienen otra reunión a esa hora. */
async function openSeats(
  startsAt: string,
  ignoreId?: string | null,
): Promise<ScheduleDto[]> {
  const startMs = Date.parse(startsAt);
  const endMs = startMs + SLOT_MINUTES * 60_000;
  const parts = limaParts(new Date(startsAt));
  const [schedules, busy] = await Promise.all([
    ensureAdvisorSchedules(),
    loadBusy(ignoreId),
  ]);
  const open = schedules.filter((schedule) => {
    if (coverageKind(schedule, parts.weekdayMon0, parts.minuteOfDay, SLOT_MINUTES) !== "work") {
      return false;
    }
    return !busy.some(
      (span) => span.advisorEmail === schedule.email && overlapsSlot(span, startMs, endMs),
    );
  });
  return open;
}

async function claimSeat(input: {
  startsAt: string;
  ignoreId?: string | null;
  preferredEmail?: string | null;
  write: (
    advisor: ScheduleDto,
  ) => PromiseLike<{ data: MeetingRow | null; error: { code?: string; message?: string } | null }>;
}): Promise<MeetingRow> {
  const preferred = input.preferredEmail?.trim().toLowerCase() || null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let seats = await openSeats(input.startsAt, input.ignoreId);
    if (preferred) {
      seats = seats.filter((seat) => seat.email === preferred);
    } else {
      const startMs = Date.parse(input.startsAt);
      const endMs = startMs + SLOT_MINUTES * 60_000;
      const unassigned = (await loadBusy(input.ignoreId)).filter(
        (span) => !span.advisorEmail && overlapsSlot(span, startMs, endMs),
      ).length;
      seats = seats.slice(unassigned);
    }
    for (const advisor of seats) {
      const { data, error } = await input.write(advisor);
      if (!error && data) return data;
      if (isUniqueViolation(error)) continue;
      raise(error, "No se pudo reservar el horario.");
    }
  }
  throw new MeetingError(
    preferred ? "advisor" : "slot_taken",
    preferred
      ? "Ese asesor ya tiene una reunión ahí."
      : "Ese horario ya no está libre.",
  );
}

function limaWhen(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

async function notifyStaff(input: { title: string; body: string; meetingId: string }) {
  const schedules = await ensureAdvisorSchedules();
  const seen = new Set<string>();
  await Promise.all(
    schedules.map(async (schedule) => {
      if (!schedule.userId || seen.has(schedule.userId)) return;
      seen.add(schedule.userId);
      await createNotificationBestEffort({
        userId: schedule.userId,
        title: input.title,
        body: input.body,
        type: "support_meeting",
        data: { meetingId: input.meetingId, url: "/support" },
      });
    }),
  );
  const { sendWebPushToEmails } = await import("@/lib/push/send-web-push.server");
  await sendWebPushToEmails(
    schedules.map((schedule) => schedule.email),
    { title: input.title, body: input.body, url: "/support" },
  );
}

export async function getAvailability(input: {
  fromYmd?: string | null;
  dayCount?: number;
  ignoreId?: string | null;
  advisorEmail?: string | null;
}): Promise<{
  today: string;
  days: string[];
  hours: number[];
  cells: HourCell[];
  advisors: AdvisorOption[];
  advisor: string | null;
}> {
  const all = await ensureAdvisorSchedules();
  const bookable = bookableAdvisors(all);
  const advisors = bookable.map((item) => ({
    email: item.email,
    displayName: item.displayName,
  }));
  const requestedAdvisor = input.advisorEmail?.trim().toLowerCase() || null;
  const schedules = requestedAdvisor
    ? bookable.filter((item) => item.email === requestedAdvisor)
    : bookable;
  const today = todayYmd();
  const requested = input.fromYmd && /^\d{4}-\d{2}-\d{2}$/.test(input.fromYmd)
    ? input.fromYmd
    : mondayOf(today);
  const monday = mondayOf(today);
  const latest = mondayOf(addDaysYmd(today, HORIZON_DAYS));
  const fromYmd = requested < monday ? monday : requested > latest ? latest : requested;
  const dayCount = Math.min(14, Math.max(1, input.dayCount ?? 7));
  const busy = await loadBusy(input.ignoreId);
  const grid = buildAvailability({
    schedules,
    busy,
    now: new Date(),
    fromYmd,
    dayCount,
  });
  return {
    today,
    ...grid,
    advisors,
    advisor: requestedAdvisor && schedules.length === 1 ? requestedAdvisor : null,
  };
}

async function listRows(filter?: { requesterId?: string }): Promise<MeetingRow[]> {
  const from = new Date(Date.now() - 90 * 86_400_000).toISOString();
  let query = db()
    .from("support_meetings")
    .select(MEETING_COLUMNS)
    .gte("starts_at", from)
    .order("starts_at", { ascending: true })
    .limit(300);
  if (filter?.requesterId) query = query.eq("requester_user_id", filter.requesterId);
  const { data, error } = await query;
  if (error) raise(error, "No se pudieron leer las reuniones.");
  return (data ?? []) as MeetingRow[];
}

export async function listClientMeetings(userId: string): Promise<MeetingDto[]> {
  const rows = await listRows({ requesterId: userId });
  return rows.map(toMeeting);
}

export async function buildStaffCounts(
  meetings: MeetingDto[],
  schedules: ScheduleDto[],
): Promise<MeetingCounts> {
  const now = Date.now();
  const { start, end } = limaDayBounds();
  const weekAgo = now - 7 * 86_400_000;
  return {
    today: meetings.filter((meeting) => {
      const startMs = Date.parse(meeting.startsAt);
      return (
        meeting.status !== "cancelled" &&
        startMs >= start.getTime() &&
        startMs < end.getTime()
      );
    }).length,
    pending: meetings.filter(
      (meeting) => meeting.status === "pending" && Date.parse(meeting.startsAt) >= now,
    ).length,
    advisorsAvailable: schedules.filter((item) => item.isAvailable).length,
    advisorsTotal: schedules.length,
    next24h: meetings.filter((meeting) => {
      const startMs = Date.parse(meeting.startsAt);
      return (
        (ACTIVE as readonly string[]).includes(meeting.status) &&
        startMs >= now &&
        startMs <= now + 86_400_000
      );
    }).length,
    attention: meetings.filter((meeting) => {
      const startMs = Date.parse(meeting.startsAt);
      return (
        (meeting.status === "no_show" || meeting.status === "rescheduled") &&
        startMs >= weekAgo
      );
    }).length,
  };
}

export async function listStaffBoard(): Promise<{
  meetings: MeetingDto[];
  schedules: ScheduleDto[];
  counts: MeetingCounts;
}> {
  const [rows, schedules] = await Promise.all([
    listRows(),
    ensureAdvisorSchedules(),
  ]);
  const meetings = rows.map(toMeeting);
  return {
    meetings,
    schedules,
    counts: await buildStaffCounts(meetings, schedules),
  };
}

export async function staffCountsOnly(): Promise<MeetingCounts> {
  const board = await listStaffBoard();
  return board.counts;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function requireBookableAdvisor(emailRaw: string): Promise<ScheduleDto> {
  const email = cleanText(emailRaw, 120).toLowerCase();
  const advisor = bookableAdvisors(await ensureAdvisorSchedules()).find(
    (item) => item.email === email,
  );
  if (!advisor) {
    throw new MeetingError("advisor", "Elige a una persona de soporte.");
  }
  return advisor;
}

async function openSlotForAdvisor(startsAt: string, advisorEmail: string, ignoreId?: string | null) {
  const today = todayYmd();
  const grid = await getAvailability({
    fromYmd: mondayOf(today),
    dayCount: 7,
    ignoreId,
    advisorEmail,
  });
  const later = await getAvailability({
    fromYmd: addDaysYmd(mondayOf(today), 7),
    dayCount: 7,
    ignoreId,
    advisorEmail,
  });
  return slotIsOpen(grid.cells, startsAt) ?? slotIsOpen(later.cells, startsAt);
}

export async function createClientMeeting(input: {
  session: SessionUser;
  startsAt: string;
  subject: string;
  notes: string;
  phone: string;
  meetingType: string;
  advisorEmail: string;
}): Promise<MeetingDto> {
  const subject = cleanText(input.subject, 160);
  const notes = cleanText(input.notes, 2000);
  const phone = cleanText(input.phone, 40);
  if (subject.length < 3) {
    throw new MeetingError("subject", "El asunto necesita al menos 3 caracteres.");
  }
  if (!isMeetingType(input.meetingType)) {
    throw new MeetingError("type", "Elige un tipo de reunión.");
  }
  if (phone && !/^[0-9+\s()-]{6,40}$/.test(phone)) {
    throw new MeetingError("phone", "Revisa el teléfono.");
  }

  const open = await listRows({ requesterId: input.session.id });
  const openCount = open.filter(
    (row) =>
      (ACTIVE as readonly string[]).includes(row.status) &&
      Date.parse(row.ends_at) > Date.now(),
  ).length;
  if (openCount >= MAX_OPEN_MEETINGS) {
    throw new MeetingError(
      "too_many",
      "Ya tienes 3 reuniones abiertas. Cancela una para agendar otra.",
    );
  }

  const advisor = await requireBookableAdvisor(input.advisorEmail);
  const slot = await openSlotForAdvisor(input.startsAt, advisor.email);
  if (!slot) {
    throw new MeetingError("advisor", "Ese asesor no está libre en ese horario.");
  }

  const organizationId = isUuid(input.session.organizationId)
    ? input.session.organizationId
    : null;
  const meeting = await claimSeat({
    startsAt: slot.startsAt,
    preferredEmail: advisor.email,
    write: (advisor) =>
      db()
        .from("support_meetings")
        .insert({
          organization_id: organizationId,
          requester_user_id: input.session.id,
          requester_name: input.session.name,
          requester_email: input.session.email,
          requester_phone: phone || null,
          advisor_user_id: advisor.userId,
          advisor_name: advisor.displayName,
          advisor_email: advisor.email,
          subject,
          notes: notes || null,
          meeting_type: input.meetingType,
          starts_at: slot.startsAt,
          ends_at: slot.endsAt,
          status: CREATED_MEETING_STATUS,
        })
        .select(MEETING_COLUMNS)
        .single(),
  });

  const when = limaWhen(meeting.starts_at);
  await createNotificationBestEffort({
    organizationId,
    userId: input.session.id,
    title: "Reunión con soporte solicitada",
    body: `${subject} · ${when}. Te confirmamos el enlace cuando el equipo la tome.`,
    type: "support_meeting",
    data: { meetingId: meeting.id, url: "/support" },
  });
  await notifyStaff({
    meetingId: meeting.id,
    title: "Nueva reunión por confirmar",
    body: `${input.session.name} pidió “${subject}” con ${advisor.displayName} para ${when}.`,
  });

  return toMeeting(meeting);
}

async function loadOwned(
  id: string,
  session: SessionUser,
  staff: boolean,
): Promise<MeetingRow> {
  if (!isUuid(id)) throw new MeetingError("not_found", "No encontramos esa reunión.");
  const { data, error } = await db()
    .from("support_meetings")
    .select(MEETING_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) raise(error, "No se pudo leer la reunión.");
  if (!data) throw new MeetingError("not_found", "No encontramos esa reunión.");
  const row = data as MeetingRow;
  if (!staff && row.requester_user_id !== session.id) {
    throw new MeetingError("forbidden", "No puedes modificar esta reunión.");
  }
  return row;
}

function fromFlow<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof MeetingFlowError) throw new MeetingError(error.code, error.message);
    throw error;
  }
}

export async function mutateClientMeeting(input: {
  session: SessionUser;
  id: string;
  action: string;
  startsAt?: string;
  advisorEmail?: string;
}): Promise<MeetingDto> {
  const row = await loadOwned(input.id, input.session, false);
  const plan = fromFlow(() =>
    planClientMutation({
      status: row.status,
      startsAtMs: Date.parse(row.starts_at),
      action: input.action,
    }),
  );

  if (plan.status === "cancelled") {
    const { data, error } = await db()
      .from("support_meetings")
      .update({ status: plan.status })
      .eq("id", row.id)
      .select(MEETING_COLUMNS)
      .single();
    if (error || !data) raise(error, "No se pudo cancelar.");
    return toMeeting(data as MeetingRow);
  }

  if (plan.clearMeetUrl) {
    if (!input.startsAt) throw new MeetingError("slot_taken", "Elige un horario.");
    const advisor = await requireBookableAdvisor(input.advisorEmail || row.advisor_email || "");
    const slot = await openSlotForAdvisor(input.startsAt, advisor.email, row.id);
    if (!slot) throw new MeetingError("advisor", "Ese asesor no está libre en ese horario.");
    const meeting = await claimSeat({
      startsAt: slot.startsAt,
      ignoreId: row.id,
      preferredEmail: advisor.email,
      write: (advisor) =>
        db()
          .from("support_meetings")
          .update({
            starts_at: slot.startsAt,
            ends_at: slot.endsAt,
            status: plan.status,
            meet_url: plan.clearMeetUrl ? null : row.meet_url,
            advisor_user_id: advisor.userId,
            advisor_name: advisor.displayName,
            advisor_email: advisor.email,
            client_reminder_at: plan.clearReminders ? null : row.client_reminder_at,
            advisor_reminder_at: plan.clearReminders ? null : row.advisor_reminder_at,
          })
          .eq("id", row.id)
          .select(MEETING_COLUMNS)
          .single(),
    });
    await notifyStaff({
      meetingId: meeting.id,
      title: "Una reunión cambió de horario",
      body: `${row.requester_name} movió “${row.subject}” a ${limaWhen(meeting.starts_at)}. Hay que confirmarla de nuevo.`,
    });
    return toMeeting(meeting);
  }

  throw new MeetingError("invalid", "Acción no disponible.");
}

export async function mutateStaffMeeting(input: {
  session: SessionUser;
  id: string;
  action: string;
  meetUrl?: string;
  advisorEmail?: string;
  startsAt?: string;
  notes?: string;
}): Promise<MeetingDto> {
  const row = await loadOwned(input.id, input.session, true);
  const schedules = await ensureAdvisorSchedules();

  if (input.action === "confirm" || input.action === "reschedule") {
    const typedUrl = cleanText(input.meetUrl, 300);
    const meetUrl = typedUrl || (input.action === "reschedule" ? row.meet_url ?? "" : "");
    const plan = fromFlow(() =>
      planStaffMutation({
        status: row.status,
        action: input.action,
        hasMeetUrl: isHttpsUrl(meetUrl),
      }),
    );
    if (plan.kind !== "schedule") throw new MeetingError("invalid", "Acción no disponible.");
    const advisorEmail = cleanText(input.advisorEmail, 120).toLowerCase() || row.advisor_email;
    const advisor = schedules.find((item) => item.email === advisorEmail);
    if (!advisor || !advisor.isAvailable) {
      throw new MeetingError("advisor", "Elige un asesor disponible.");
    }

    let startsAt = row.starts_at;
    let endsAt = row.ends_at;
    if (input.action === "reschedule") {
      if (!input.startsAt) throw new MeetingError("slot_taken", "Elige un horario.");
      const today = todayYmd();
      const grid = await getAvailability({
        fromYmd: mondayOf(today),
        dayCount: 7,
        ignoreId: row.id,
      });
      const later = await getAvailability({
        fromYmd: addDaysYmd(mondayOf(today), 7),
        dayCount: 7,
        ignoreId: row.id,
      });
      const slot =
        slotIsOpen(grid.cells, input.startsAt) ?? slotIsOpen(later.cells, input.startsAt);
      if (!slot) throw new MeetingError("slot_taken", "Ese horario ya no está libre.");
      startsAt = slot.startsAt;
      endsAt = slot.endsAt;
    }

    const slotParts = limaParts(new Date(startsAt));
    if (coverageKind(advisor, slotParts.weekdayMon0, slotParts.minuteOfDay, SLOT_MINUTES) !== "work") {
      throw new MeetingError("advisor", "Ese asesor no trabaja en ese horario.");
    }

    const saved = await claimSeat({
      startsAt,
      ignoreId: row.id,
      preferredEmail: advisor.email,
      write: (seat) =>
        db()
          .from("support_meetings")
          .update({
            status: plan.status,
            meet_url: meetUrl,
            advisor_user_id: seat.userId,
            advisor_name: seat.displayName,
            advisor_email: seat.email,
            starts_at: startsAt,
            ends_at: endsAt,
          })
          .eq("id", row.id)
          .select(MEETING_COLUMNS)
          .single(),
    });

    if (input.action === "confirm") {
      await createNotificationBestEffort({
        organizationId: row.organization_id,
        userId: row.requester_user_id,
        title: "Tu reunión con soporte está confirmada",
        body: `${row.subject} · ${limaWhen(saved.starts_at)}. Abre el enlace desde Soporte.`,
        type: "support_meeting",
        data: { meetingId: row.id, url: "/support" },
      });
    } else {
      await createNotificationBestEffort({
        organizationId: row.organization_id,
        userId: row.requester_user_id,
        title: "Tu reunión cambió de horario",
        body: `${row.subject} quedó para ${limaWhen(saved.starts_at)}. El enlace sigue en Soporte.`,
        type: "support_meeting",
        data: { meetingId: row.id, url: "/support" },
      });
    }
    return toMeeting(saved);
  }

  if (input.action === "complete" || input.action === "no_show" || input.action === "cancel") {
    const plan = fromFlow(() =>
      planStaffMutation({ status: row.status, action: input.action, hasMeetUrl: false }),
    );
    if (plan.kind !== "close") throw new MeetingError("invalid", "Acción no disponible.");
    const status = plan.status;
    const { data, error } = await db()
      .from("support_meetings")
      .update({ status })
      .eq("id", row.id)
      .select(MEETING_COLUMNS)
      .single();
    if (error || !data) raise(error, "No se pudo actualizar el estado.");
    return toMeeting(data as MeetingRow);
  }

  if (input.action === "remind") {
    const plan = fromFlow(() =>
      planStaffMutation({ status: row.status, action: "remind", hasMeetUrl: false }),
    );
    if (plan.kind !== "remind") throw new MeetingError("invalid", "Acción no disponible.");
    const nowIso = new Date().toISOString();
    const { data, error } = await db()
      .from("support_meetings")
      .update({
        client_reminder_at: nowIso,
        advisor_reminder_at: nowIso,
      })
      .eq("id", row.id)
      .select(MEETING_COLUMNS)
      .single();
    if (error || !data) raise(error, "No se pudo enviar el recordatorio.");
    const when = new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(row.starts_at));
    await createNotificationBestEffort({
      organizationId: row.organization_id,
      userId: row.requester_user_id,
      title: "Recordatorio de reunión",
      body: `${row.subject} · ${when}. Encuéntrala en Soporte.`,
      type: "support_meeting",
      data: { meetingId: row.id },
    });
    if (row.advisor_user_id) {
      await createNotificationBestEffort({
        userId: row.advisor_user_id,
        title: "Recordatorio de reunión",
        body: `${row.requester_name} · ${row.subject} · ${when}`,
        type: "support_meeting",
        data: { meetingId: row.id },
      });
    }
    return toMeeting(data as MeetingRow);
  }

  if (input.action === "notes") {
    fromFlow(() => planStaffMutation({ status: row.status, action: "notes", hasMeetUrl: false }));
    const notes = cleanText(input.notes, 2000);
    const { data, error } = await db()
      .from("support_meetings")
      .update({ notes: notes || null })
      .eq("id", row.id)
      .select(MEETING_COLUMNS)
      .single();
    if (error || !data) raise(error, "No se pudieron guardar las notas.");
    return toMeeting(data as MeetingRow);
  }

  throw new MeetingError("invalid", "Acción no disponible.");
}

export async function updateAdvisorSchedule(input: {
  email: string;
  displayName: string;
  weekdayMask: number;
  startMinute: number;
  endMinute: number;
  breakStartMinute: number;
  breakEndMinute: number;
  isAvailable: boolean;
}): Promise<ScheduleDto> {
  const email = input.email.trim().toLowerCase();
  const displayName = cleanText(input.displayName, 40);
  const minutes = [
    input.startMinute,
    input.endMinute,
    input.breakStartMinute,
    input.breakEndMinute,
  ];
  const minutesOk = minutes.every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 1440 && value % 30 === 0,
  );
  if (
    !email ||
    displayName.length < 2 ||
    !Number.isInteger(input.weekdayMask) ||
    input.weekdayMask < 1 ||
    input.weekdayMask > 127 ||
    !minutesOk ||
    !(input.startMinute < input.breakStartMinute) ||
    !(input.breakStartMinute < input.breakEndMinute) ||
    !(input.breakEndMinute < input.endMinute)
  ) {
    throw new MeetingError("invalid", "Revisa días y horas del horario.");
  }

  const { data, error } = await db()
    .from("support_advisor_schedules")
    .update({
      display_name: displayName,
      weekday_mask: input.weekdayMask,
      start_minute: input.startMinute,
      end_minute: input.endMinute,
      break_start_minute: input.breakStartMinute,
      break_end_minute: input.breakEndMinute,
      is_available: input.isAvailable,
    })
    .eq("email", email)
    .select(
      "email, user_id, display_name, weekday_mask, start_minute, end_minute, break_start_minute, break_end_minute, is_available",
    )
    .maybeSingle();
  if (error) raise(error, "No se pudo guardar el horario.");
  if (!data) throw new MeetingError("not_found", "No encontramos ese asesor.");
  return toSchedule(data as ScheduleRow);
}
