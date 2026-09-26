"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import {
  MEETING_TYPES,
  formatMinute,
  limaWallToUtc,
  mondayOf,
  todayYmd,
  type FreeSlot,
  type HourCell,
  type HourKind,
  type MeetingType,
} from "@/features/support/lib/meeting-slots";
import type { AdvisorOption, MeetingDto } from "@/features/support/lib/meeting-types";

const ACTIVE = new Set(["pending", "confirmed", "rescheduled"]);
const ERROR_CODES = [
  "subject",
  "type",
  "phone",
  "too_many",
  "slot_taken",
  "terminal",
  "started",
  "unavailable",
  "meet_url",
  "generic",
  "forbidden",
  "not_found",
  "advisor",
] as const;

type ErrorCode = (typeof ERROR_CODES)[number];

type GridResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  today: string;
  days: string[];
  hours: number[];
  cells: HourCell[];
  advisors?: AdvisorOption[];
  advisor?: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}

function limaDate(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return limaWallToUtc(year, month, day, 12 * 60);
}

function statusClass(status: string) {
  if (status === "confirmed") return "bg-emerald-50 text-emerald-800";
  if (status === "pending") return "bg-amber-50 text-amber-800";
  if (status === "rescheduled") return "bg-orange-50 text-orange-800";
  if (status === "completed") return "bg-slate-100 text-slate-600";
  if (status === "no_show") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-500";
}

function cellClass(kind: HourKind, active: boolean) {
  return cn(
    "flex h-10 items-center justify-center rounded-md text-[10px] font-semibold transition-colors",
    kind === "free" && "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
    kind === "break" && "bg-amber-50 text-amber-800",
    kind === "full" && "bg-slate-200/80 text-slate-500",
    kind === "off" && "bg-[var(--surface-soft)] text-transparent",
    active && "ring-2 ring-[var(--auth-accent)] ring-offset-1",
  );
}

export function ClientMeetingsPanel({ onBack }: { onBack: () => void }) {
  const t = useTranslations("support");
  const locale = useLocale();
  const currentMonday = mondayOf(todayYmd());

  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [meetings, setMeetings] = useState<MeetingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<HourCell | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([]);
  const [meetingType, setMeetingType] = useState<MeetingType>("consulta");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const labelDay = useCallback(
    (ymd: string, withWeekday = true) =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "America/Lima",
        weekday: withWeekday ? "short" : undefined,
        day: "numeric",
        month: withWeekday ? undefined : "short",
      }).format(limaDate(ymd)),
    [locale],
  );

  const labelWhen = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "America/Lima",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(iso)),
    [locale],
  );

  const explain = useCallback(
    (code: string | undefined) =>
      code && isErrorCode(code) ? t(`meetings.errors.${code}`) : t("meetings.errors.generic"),
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: currentMonday, days: "14" });
      if (rescheduleId) params.set("ignore", rescheduleId);
      if (advisorEmail) params.set("advisor", advisorEmail);
      const [slotsRes, meetingsRes] = await Promise.all([
        fetch(`/api/support/meetings/slots?${params}`, { credentials: "include", cache: "no-store" }),
        fetch("/api/support/meetings", { credentials: "include", cache: "no-store" }),
      ]);
      const slots = (await slotsRes.json()) as GridResponse;
      const list = (await meetingsRes.json()) as { ok?: boolean; code?: string; meetings?: MeetingDto[] };
      if (!slotsRes.ok || !slots.ok) throw new Error(slots.code ?? "invalid");
      if (!meetingsRes.ok || !list.ok) throw new Error(list.code ?? "invalid");
      setGrid(slots);
      setAdvisors(slots.advisors ?? []);
      setMeetings(list.meetings ?? []);
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : "invalid"));
    } finally {
      setLoading(false);
    }
  }, [advisorEmail, currentMonday, explain, rescheduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openMeetings = meetings.filter(
    (meeting) => ACTIVE.has(meeting.status) && Date.parse(meeting.endsAt) > Date.now(),
  );
  const nextMeeting = [...openMeetings].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  )[0];
  const pendingCount = openMeetings.filter((meeting) => meeting.status === "pending").length;
  const confirmedCount = openMeetings.filter((meeting) => meeting.status !== "pending").length;
  const doneCount = meetings.filter((meeting) => meeting.status === "completed").length;
  const atLimit = openMeetings.length >= 3 && !rescheduleId;
  const selected = meetings.find((meeting) => meeting.id === selectedId) ?? null;

  const cellsByKey = useMemo(() => {
    const map = new Map<string, HourCell>();
    for (const cell of grid?.cells ?? []) map.set(`${cell.day}-${cell.minute}`, cell);
    return map;
  }, [grid]);

  const selectedAdvisor = advisors.find((person) => person.email === advisorEmail) ?? null;
  const gridReady = Boolean(advisorEmail) && grid?.advisor === advisorEmail;

  function chooseAdvisor(email: string) {
    if (email === advisorEmail) return;
    setAdvisorEmail(email);
    setSelectedCell(null);
    setSelectedSlot(null);
    setGrid(null);
  }

  async function submitBooking() {
    if (!selectedSlot || !advisorEmail || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/support/meetings", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt: selectedSlot.startsAt,
          subject,
          notes,
          phone,
          meetingType,
          advisorEmail,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string; meeting?: MeetingDto };
      if (!res.ok || !data.ok || !data.meeting) throw new Error(data.code ?? "invalid");
      setSubject("");
      setNotes("");
      setPhone("");
      setSelectedCell(null);
      setSelectedSlot(null);
      setSelectedId(data.meeting.id);
      setNotice(t("meetings.saved"));
      await load();
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : "invalid"));
    } finally {
      setSaving(false);
    }
  }

  async function patchMeeting(id: string, body: Record<string, string>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/meetings/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string; meeting?: MeetingDto };
      if (!res.ok || !data.ok || !data.meeting) throw new Error(data.code ?? "invalid");
      setSelectedId(data.meeting.id);
      setRescheduleId(null);
      setSelectedCell(null);
      setSelectedSlot(null);
      if (body.action === "reschedule") setNotice(t("meetings.moved"));
      if (body.action === "cancel") setNotice(t("meetings.cancelled"));
      await load();
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : "invalid"));
    } finally {
      setSaving(false);
    }
  }

  function chooseCell(cell: HourCell) {
    if (cell.kind !== "free" || cell.slots.length === 0) return;
    if (atLimit && !rescheduleId) {
      setError(t("meetings.errors.too_many"));
      return;
    }
    setSelectedCell(cell);
    setSelectedSlot(cell.slots[0] ?? null);
    setNotice(null);
    if (!rescheduleId) setSelectedId(null);
  }

  const weeks = useMemo(() => {
    const days = grid?.days ?? [];
    const chunks: string[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      chunks.push(days.slice(index, index + 7));
    }
    return chunks;
  }, [grid]);

  const rangeLabel =
    grid && grid.days.length > 0
      ? `${labelDay(grid.days[0], false)} – ${labelDay(grid.days[grid.days.length - 1], false)}`
      : "";

  function weekHasFree(days: string[]) {
    const hours = grid?.hours ?? [];
    return days.some((day) =>
      hours.some((hour) => (cellsByKey.get(`${day}-${hour}`)?.slots.length ?? 0) > 0),
    );
  }

  function startReschedule(meeting: MeetingDto) {
    const nextAdvisor =
      meeting.advisorEmail && advisors.some((person) => person.email === meeting.advisorEmail)
        ? meeting.advisorEmail
        : advisorEmail;
    if (nextAdvisor && nextAdvisor !== advisorEmail) {
      setAdvisorEmail(nextAdvisor);
      setGrid(null);
    }
    setSelectedId(meeting.id);
    setRescheduleId(meeting.id);
    setSelectedCell(null);
    setSelectedSlot(null);
    setNotice(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-[12px] font-semibold text-[var(--auth-accent)] lg:hidden"
          >
            {t("meetings.back")}
          </button>
          <h2 className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            {t("meetings.title")}
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--auth-text-muted)]">
            {t("meetings.subtitle")}
          </p>
        </div>
        <p className="shrink-0 text-[12px] font-semibold capitalize text-[var(--auth-text)]">{rangeLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Metric label={t("meetings.kpis.next")} value={nextMeeting ? labelWhen(nextMeeting.startsAt) : t("meetings.noneNext")} />
        <Metric label={t("meetings.kpis.pending")} value={String(pendingCount)} />
        <Metric label={t("meetings.kpis.confirmed")} value={String(confirmedCount)} />
        <Metric label={t("meetings.kpis.done")} value={String(doneCount)} />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
          {notice}
        </p>
      ) : null}
      {rescheduleId ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[13px] text-orange-900">
          <p>{t("meetings.rescheduleHint")}</p>
          <button
            type="button"
            onClick={() => {
              setRescheduleId(null);
              setSelectedCell(null);
              setSelectedSlot(null);
            }}
            className="shrink-0 font-semibold"
          >
            {t("meetings.cancelBook")}
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
        <section className="dashboard-surface-card rounded-[1.15rem] p-3 sm:p-4">
          <div className="mb-3">
            <p className="mb-2 text-[12px] font-semibold text-[var(--auth-text)]">{t("meetings.withWho")}</p>
            <div className="flex flex-wrap gap-2">
              {advisors.map((person) => {
                const active = advisorEmail === person.email;
                return (
                  <button
                    key={person.email}
                    type="button"
                    onClick={() => chooseAdvisor(person.email)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[13px] font-semibold",
                      active
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
                        : "border-[var(--auth-input-border)] bg-white text-[var(--auth-text)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold",
                        active ? "bg-white/20 text-white" : "bg-orange-100 text-orange-800",
                      )}
                    >
                      {initials(person.displayName)}
                    </span>
                    {person.displayName}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-[var(--auth-text)]">
              {advisorEmail ? t("meetings.clickHint") : t("meetings.pickPerson")}
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-medium text-[var(--auth-text-muted)]">
              <Legend swatch="bg-emerald-100" label={t("meetings.legendFree")} />
              <Legend swatch="bg-amber-50" label={t("meetings.legendBreak")} />
              <Legend swatch="bg-slate-200" label={t("meetings.legendFull")} />
            </div>
          </div>
          {!advisorEmail ? (
            <p className="py-16 text-center text-[13px] text-[var(--auth-text-muted)]">{t("meetings.pickPerson")}</p>
          ) : !gridReady ? (
            <p className="py-16 text-center text-[13px] text-[var(--auth-text-muted)]">{t("meetings.loading")}</p>
          ) : (
            <div className="space-y-5">
              {weeks.map((days, index) => (
                <WeekGrid
                  key={days[0] ?? index}
                  title={index === 0 ? t("meetings.thisWeek") : t("meetings.nextWeek")}
                  note={index === 0 && !weekHasFree(days) ? t("meetings.weekFull") : null}
                  days={days}
                  hours={grid?.hours ?? []}
                  cellsByKey={cellsByKey}
                  selectedKey={selectedCell ? `${selectedCell.day}-${selectedCell.minute}` : ""}
                  onChoose={chooseCell}
                  labelDay={labelDay}
                  labelFor={(kind) =>
                    kind === "free"
                      ? t("meetings.legendFree")
                      : kind === "break"
                        ? t("meetings.legendBreak")
                        : kind === "full"
                          ? t("meetings.legendFull")
                          : ""
                  }
                />
              ))}
            </div>
          )}
        </section>

        <aside className="dashboard-surface-card rounded-[1.15rem] p-4">
          {selectedSlot && !rescheduleId ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitBooking();
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
                    {t("meetings.bookTitle")}
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-[var(--auth-text)]">
                    {labelWhen(selectedSlot.startsAt)}
                  </p>
                  <p className="text-[12px] text-[var(--auth-text-muted)]">{t("meetings.duration")}</p>
                  {selectedAdvisor ? (
                    <p className="text-[12px] font-semibold text-[var(--auth-text)]">
                      {t("meetings.withAdvisor", { name: selectedAdvisor.displayName })}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCell(null);
                    setSelectedSlot(null);
                  }}
                  className="text-[12px] font-semibold text-[var(--auth-text-muted)]"
                >
                  {t("meetings.cancelBook")}
                </button>
              </div>
              {selectedCell && selectedCell.slots.length > 1 ? (
                <div className="flex gap-2">
                  {selectedCell.slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[12px] font-semibold",
                        selectedSlot.startsAt === slot.startsAt
                          ? "bg-[var(--brand-primary)] text-white"
                          : "bg-[var(--surface-soft)] text-[var(--auth-text)]",
                      )}
                    >
                      {formatMinute(slot.minute)}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="block text-[12px] font-semibold text-[var(--auth-text)]">
                {t("meetings.type")}
                <select
                  value={meetingType}
                  onChange={(event) => setMeetingType(event.target.value as MeetingType)}
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--auth-input-border)] bg-white px-3 text-[14px] font-medium"
                >
                  {MEETING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`meetings.types.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-semibold text-[var(--auth-text)]">
                {t("meetings.subject")}
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t("meetings.subjectPh")}
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--auth-input-border)] px-3 text-[14px] font-medium placeholder:font-normal"
                />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--auth-text)]">
                {t("meetings.notes")}
                <textarea
                  value={notes}
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t("meetings.notesPh")}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-lg border border-[var(--auth-input-border)] px-3 py-2 text-[14px] font-medium placeholder:font-normal"
                />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--auth-text)]">
                {t("meetings.phone")}
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t("meetings.phonePh")}
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--auth-input-border)] px-3 text-[14px] font-medium placeholder:font-normal"
                />
              </label>
              <button
                type="submit"
                disabled={saving || atLimit}
                className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {saving ? t("meetings.submitting") : t("meetings.submit")}
              </button>
            </form>
          ) : selected ? (
            <MeetingDetail
              meeting={selected}
              saving={saving}
              when={labelWhen(selected.startsAt)}
              onClose={() => setSelectedId(null)}
              onCancel={() => {
                if (window.confirm(t("meetings.cancelAsk"))) {
                  void patchMeeting(selected.id, { action: "cancel" });
                }
              }}
              onReschedule={() => startReschedule(selected)}
              onMove={() => {
                if (!selectedSlot || !advisorEmail) return;
                void patchMeeting(selected.id, {
                  action: "reschedule",
                  startsAt: selectedSlot.startsAt,
                  advisorEmail,
                });
              }}
              moving={rescheduleId === selected.id}
              canMove={Boolean(selectedSlot)}
              nextWhen={selectedSlot ? labelWhen(selectedSlot.startsAt) : null}
            />
          ) : (
            <MeetingList
              meetings={meetings}
              labelWhen={labelWhen}
              onSelect={setSelectedId}
              onReschedule={startReschedule}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="dashboard-surface-card rounded-xl px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">{label}</p>
      <p className="mt-1 truncate text-[14px] font-bold capitalize text-[var(--auth-text)]">{value}</p>
    </article>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", swatch)} />
      {label}
    </span>
  );
}

function WeekGrid({
  title,
  note,
  days,
  hours,
  cellsByKey,
  selectedKey,
  onChoose,
  labelDay,
  labelFor,
}: {
  title: string;
  note: string | null;
  days: string[];
  hours: number[];
  cellsByKey: Map<string, HourCell>;
  selectedKey: string;
  onChoose: (cell: HourCell) => void;
  labelDay: (ymd: string) => string;
  labelFor: (kind: HourKind) => string;
}) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text)]">{title}</p>
      {note ? <p className="mb-2 text-[12px] leading-relaxed text-[var(--auth-text-muted)]">{note}</p> : null}
      <div className="overflow-x-auto">
        <div className="grid min-w-[36rem] grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1">
          <span />
          {days.map((day) => (
            <span key={day} className="pb-1 text-center text-[11px] font-semibold capitalize text-[var(--auth-text-muted)]">
              {labelDay(day)}
            </span>
          ))}
          {hours.map((hour) => (
            <HourRow
              key={`${days[0]}-${hour}`}
              hour={hour}
              days={days}
              cellsByKey={cellsByKey}
              selectedKey={selectedKey}
              onChoose={onChoose}
              labelFor={labelFor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HourRow({
  hour,
  days,
  cellsByKey,
  selectedKey,
  onChoose,
  labelFor,
}: {
  hour: number;
  days: string[];
  cellsByKey: Map<string, HourCell>;
  selectedKey: string;
  onChoose: (cell: HourCell) => void;
  labelFor: (kind: HourKind) => string;
}) {
  return (
    <>
      <span className="flex items-center text-[11px] font-medium tabular-nums text-[var(--auth-text-soft)]">
        {formatMinute(hour)}
      </span>
      {days.map((day) => {
        const cell = cellsByKey.get(`${day}-${hour}`);
        if (!cell) return <span key={day} />;
        const active = selectedKey === `${day}-${hour}`;
        return (
          <button
            key={day}
            type="button"
            disabled={cell.kind !== "free"}
            onClick={() => onChoose(cell)}
            className={cellClass(cell.kind, active)}
          >
            {labelFor(cell.kind)}
          </button>
        );
      })}
    </>
  );
}

function MeetingGroup({
  title,
  meetings,
  empty,
  labelWhen,
  onSelect,
  onReschedule,
}: {
  title: string;
  meetings: MeetingDto[];
  empty?: string;
  labelWhen: (iso: string) => string;
  onSelect: (id: string) => void;
  onReschedule?: (meeting: MeetingDto) => void;
}) {
  const t = useTranslations("support");
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">{title}</p>
      {meetings.length === 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--auth-text-muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {meetings.map((meeting) => {
            const canMove = Boolean(onReschedule) && Date.parse(meeting.startsAt) > Date.now();
            return (
              <li key={meeting.id} className="rounded-xl border border-[var(--auth-input-border)] px-3 py-2.5">
                <button type="button" onClick={() => onSelect(meeting.id)} className="flex w-full items-start justify-between gap-3 text-left">
                  <span>
                    <span className="block text-[13px] font-semibold text-[var(--auth-text)]">{meeting.subject}</span>
                    <span className="mt-0.5 block text-[12px] capitalize text-[var(--auth-text-muted)]">
                      {labelWhen(meeting.startsAt)}
                      {meeting.advisorName ? ` · ${meeting.advisorName}` : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", statusClass(meeting.status))}>
                    {t(`meetings.statuses.${meeting.status}`)}
                  </span>
                </button>
                {canMove ? (
                  <button
                    type="button"
                    onClick={() => onReschedule?.(meeting)}
                    className="mt-2 text-[12px] font-semibold text-[var(--auth-accent)]"
                  >
                    {t("meetings.reschedule")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MeetingList({
  meetings,
  labelWhen,
  onSelect,
  onReschedule,
}: {
  meetings: MeetingDto[];
  labelWhen: (iso: string) => string;
  onSelect: (id: string) => void;
  onReschedule: (meeting: MeetingDto) => void;
}) {
  const t = useTranslations("support");
  const upcoming = meetings
    .filter((meeting) => ACTIVE.has(meeting.status) && Date.parse(meeting.endsAt) >= Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const history = meetings
    .filter((meeting) => !upcoming.some((item) => item.id === meeting.id))
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  if (meetings.length === 0) {
    return <p className="py-8 text-center text-[13px] leading-relaxed text-[var(--auth-text-muted)]">{t("meetings.empty")}</p>;
  }
  return (
    <div className="space-y-4">
      <MeetingGroup title={t("meetings.upcoming")} meetings={upcoming} empty={t("meetings.noUpcoming")} labelWhen={labelWhen} onSelect={onSelect} onReschedule={onReschedule} />
      {history.length > 0 ? (
        <MeetingGroup title={t("meetings.history")} meetings={history} labelWhen={labelWhen} onSelect={onSelect} />
      ) : null}
    </div>
  );
}

function MeetingDetail({
  meeting,
  when,
  saving,
  moving,
  canMove,
  nextWhen,
  onClose,
  onCancel,
  onReschedule,
  onMove,
}: {
  meeting: MeetingDto;
  when: string;
  saving: boolean;
  moving: boolean;
  canMove: boolean;
  nextWhen: string | null;
  onClose: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onMove: () => void;
}) {
  const t = useTranslations("support");
  const open = ACTIVE.has(meeting.status) && Date.parse(meeting.startsAt) > Date.now();
  const canJoin = Boolean(meeting.meetUrl) && (meeting.status === "confirmed" || meeting.status === "rescheduled");
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">{t("meetings.detail")}</p>
        <button type="button" onClick={onClose} className="text-[12px] font-semibold text-[var(--auth-text-muted)]">
          {t("meetings.cancelBook")}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-bold text-[var(--auth-text)]">{meeting.subject}</h3>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", statusClass(meeting.status))}>
          {t(`meetings.statuses.${meeting.status}`)}
        </span>
      </div>
      <dl className="space-y-2 text-[13px]">
        <Row label={t("meetings.when")} value={when} />
        <Row label={t("meetings.type")} value={t(`meetings.types.${meeting.meetingType}`)} />
        <Row label={t("meetings.advisor")} value={meeting.advisorName ?? t("meetings.unassigned")} />
        <Row label={t("meetings.channel")} value={t("meetings.channelValue")} />
        <Row
          label={t("meetings.reminder")}
          value={meeting.clientReminderSent ? t("meetings.sent") : t("meetings.pendingBadge")}
        />
      </dl>
      {meeting.notes ? (
        <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-[13px] text-[var(--auth-text)]">
          {meeting.notes}
        </p>
      ) : null}
      {canJoin ? (
        <a
          href={meeting.meetUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 items-center justify-center rounded-lg bg-emerald-600 text-[14px] font-semibold text-white"
        >
          {t("meetings.join")}
        </a>
      ) : open ? (
        <p className="text-[12px] leading-relaxed text-[var(--auth-text-muted)]">{t("meetings.pendingLink")}</p>
      ) : null}
      {open ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onReschedule}
            className="h-10 flex-1 rounded-lg border border-[var(--auth-input-border)] text-[13px] font-semibold text-[var(--auth-text)]"
          >
            {t("meetings.reschedule")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="h-10 flex-1 rounded-lg border border-rose-200 text-[13px] font-semibold text-rose-700"
          >
            {t("meetings.cancel")}
          </button>
        </div>
      ) : null}
      {moving ? (
        <button
          type="button"
          disabled={saving || !canMove}
          onClick={onMove}
          className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {canMove && nextWhen ? t("meetings.moveToWhen", { when: nextWhen }) : t("meetings.moveTo")}
        </button>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[var(--auth-text-muted)]">{label}</dt>
      <dd className="text-right font-semibold capitalize text-[var(--auth-text)]">{value}</dd>
    </div>
  );
}
