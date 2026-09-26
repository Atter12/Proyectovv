"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  HORIZON_DAYS,
  addDaysYmd,
  formatMinute,
  limaDayBounds,
  limaParts,
  limaWallToUtc,
  mondayOf,
  todayYmd,
  weekdayLabel,
  type HourCell,
  type HourKind,
} from "@/features/support/lib/meeting-slots";
import type { MeetingCounts, MeetingDto, ScheduleDto } from "@/features/support/lib/meeting-types";

const TYPES = ["consulta", "onboarding", "revision", "estrategia", "seguimiento", "soporte"] as const;
const STATUSES = ["pending", "confirmed", "completed", "rescheduled", "cancelled", "no_show"] as const;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TYPE_LABEL: Record<string, string> = {
  consulta: "Consulta",
  onboarding: "Onboarding",
  revision: "Revisión",
  estrategia: "Estrategia",
  seguimiento: "Seguimiento",
  soporte: "Soporte",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  rescheduled: "Reprogramada",
  cancelled: "Cancelada",
  no_show: "No show",
};

type BoardResponse = {
  ok?: boolean;
  error?: string;
  meetings: MeetingDto[];
  schedules: ScheduleDto[];
  counts: MeetingCounts;
};

function limaDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return limaWallToUtc(year, month, day, 12 * 60);
}

function whenLabel(iso: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function statusClass(status: string) {
  if (status === "confirmed") return "bg-emerald-50 text-emerald-800";
  if (status === "pending") return "bg-amber-50 text-amber-800";
  if (status === "rescheduled") return "bg-orange-50 text-orange-800";
  if (status === "no_show") return "bg-rose-50 text-rose-700";
  if (status === "completed") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-500";
}

function cellClass(kind: HourKind) {
  if (kind === "free") return "bg-emerald-100 text-emerald-800";
  if (kind === "break") return "bg-amber-50 text-amber-800";
  if (kind === "full") return "bg-slate-200 text-slate-500";
  return "bg-[#f3f1ee] text-transparent";
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function StaffMeetingsBoard({
  onBackToChats,
  onPending,
}: {
  onBackToChats: () => void;
  onPending?: (count: number) => void;
}) {
  const currentMonday = mondayOf(todayYmd());
  const maxMonday = mondayOf(addDaysYmd(todayYmd(), HORIZON_DAYS));
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [cells, setCells] = useState<HourCell[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [hours, setHours] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editing, setEditing] = useState<ScheduleDto | null>(null);
  const [moving, setMoving] = useState(false);
  const [slotStart, setSlotStart] = useState<string>("");
  const [slotChoices, setSlotChoices] = useState<{ startsAt: string; minute: number }[]>([]);
  const [meetUrl, setMeetUrl] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const loadBoard = useCallback(async () => {
    const res = await fetch("/api/support/meetings", { credentials: "include", cache: "no-store" });
    const data = (await res.json()) as BoardResponse;
    if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cargar la agenda.");
    setBoard(data);
    onPending?.(data.counts.pending);
  }, [onPending]);

  const loadSlots = useCallback(async (ignore?: string) => {
    const params = new URLSearchParams({ from: weekStart, days: "7" });
    if (ignore) params.set("ignore", ignore);
    const res = await fetch(`/api/support/meetings/slots?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      days: string[];
      hours: number[];
      cells: HourCell[];
    };
    if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cargar la disponibilidad.");
    setDays(data.days);
    setHours(data.hours);
    setCells(data.cells);
  }, [weekStart]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadBoard(), loadSlots(moving && selectedId ? selectedId : undefined)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, [loadBoard, loadSlots, moving, selectedId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const meetings = board?.meetings ?? [];
  const schedules = board?.schedules ?? [];
  const counts = board?.counts;
  const selected = meetings.find((meeting) => meeting.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings.filter((meeting) => {
      if (statusFilter !== "all" && meeting.status !== statusFilter) return false;
      if (typeFilter !== "all" && meeting.meetingType !== typeFilter) return false;
      if (!q) return true;
      return [meeting.requesterName, meeting.requesterEmail, meeting.subject, meeting.advisorName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [meetings, query, statusFilter, typeFilter]);

  const todayMeetings = useMemo(() => {
    const bounds = limaDayBounds();
    return meetings
      .filter((meeting) => {
        const start = Date.parse(meeting.startsAt);
        return meeting.status !== "cancelled" && start >= bounds.start.getTime() && start < bounds.end.getTime();
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [meetings]);

  async function runAction(body: Record<string, string>) {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/meetings/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo actualizar.");
      setMoving(false);
      setSlotStart("");
      setSlotChoices([]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/support/meetings/schedules", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar el horario.");
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el horario.");
    } finally {
      setSaving(false);
    }
  }

  const cellsByKey = useMemo(() => {
    const map = new Map<string, HourCell>();
    for (const cell of cells) map.set(`${cell.day}-${cell.minute}`, cell);
    return map;
  }, [cells]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f4f1]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">Soporte</p>
          <h1 className="text-[16px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">Reuniones</h1>
        </div>
        <button
          type="button"
          onClick={onBackToChats}
          className="rounded-lg border border-[var(--auth-input-border)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--auth-text)]"
        >
          Volver a chats
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Reuniones hoy" value={String(counts?.today ?? 0)} detail="En el día de Lima" />
          <Kpi label="Por confirmar" value={String(counts?.pending ?? 0)} detail="Esperan enlace" />
          <Kpi
            label="Asesores disponibles"
            value={`${counts?.advisorsAvailable ?? 0} / ${counts?.advisorsTotal ?? 0}`}
            detail="Con horario activo"
          />
          <Kpi label="Próximas 24 h" value={String(counts?.next24h ?? 0)} detail="Pendientes o confirmadas" />
          <Kpi label="No show / reprogramadas" value={String(counts?.attention ?? 0)} detail="Últimos 7 días" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_18rem]">
          <section className="dashboard-surface-card rounded-[1.15rem] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold text-[var(--auth-text)]">Horarios del equipo</h2>
            </div>
            <p className="mt-1 text-[12px] text-[var(--auth-text-muted)]">
              El cliente solo ve los bloques donde alguien está libre.
            </p>
            <ul className="mt-3 space-y-2">
              {schedules.map((schedule) => (
                <li key={schedule.email} className="rounded-xl border border-[var(--auth-input-border)] bg-white p-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#1a1008_0%,#e8451a_140%)] text-[12px] font-bold text-white">
                      {initials(schedule.displayName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[14px] font-bold text-[var(--auth-text)]">{schedule.displayName}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold",
                            schedule.isAvailable ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700",
                          )}
                        >
                          {schedule.isAvailable ? "Disponible" : "Ocupado"}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--auth-text-muted)]">
                        {weekdayLabel(schedule.weekdayMask)} · {formatMinute(schedule.startMinute)}–
                        {formatMinute(schedule.endMinute)}
                      </p>
                      <p className="text-[12px] text-[var(--auth-text-soft)]">
                        Descanso {formatMinute(schedule.breakStartMinute)}–{formatMinute(schedule.breakEndMinute)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditing(schedule)}
                        className="mt-2 text-[12px] font-semibold text-[var(--auth-accent)]"
                      >
                        Editar horario
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="dashboard-surface-card rounded-[1.15rem] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-bold text-[var(--auth-text)]">Disponibilidad semanal</h2>
                <p className="text-[12px] text-[var(--auth-text-muted)]">
                  {moving ? "Elige un bloque verde para mover la reunión." : "Lo mismo que ve el cliente al agendar."}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Semana anterior"
                  disabled={weekStart <= currentMonday}
                  onClick={() => setWeekStart((value) => addDaysYmd(value, -7))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--auth-input-border)] disabled:opacity-40"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Semana siguiente"
                  disabled={weekStart >= maxMonday}
                  onClick={() => setWeekStart((value) => addDaysYmd(value, 7))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--auth-input-border)] disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
            {loading && cells.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-[var(--auth-text-muted)]">Cargando disponibilidad…</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid min-w-[34rem] grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-1">
                  <span />
                  {days.map((day) => (
                    <span key={day} className="text-center text-[10px] font-semibold capitalize text-[var(--auth-text-muted)]">
                      {new Intl.DateTimeFormat("es-PE", {
                        timeZone: "America/Lima",
                        weekday: "short",
                        day: "numeric",
                      }).format(limaDate(day))}
                    </span>
                  ))}
                  {hours.map((hour) => (
                    <WeekHour
                      key={hour}
                      hour={hour}
                      days={days}
                      cellsByKey={cellsByKey}
                      onPick={(cell) => {
                        if (!moving || cell.slots.length === 0) return;
                        const choices = cell.slots.map((slot) => ({
                          startsAt: slot.startsAt,
                          minute: slot.minute,
                        }));
                        setSlotChoices(choices);
                        setSlotStart(choices.length === 1 ? choices[0].startsAt : "");
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="dashboard-surface-card rounded-[1.15rem] p-4">
            <h2 className="text-[14px] font-bold text-[var(--auth-text)]">Agenda de hoy</h2>
            <p className="mt-1 text-[12px] capitalize text-[var(--auth-text-muted)]">
              {new Intl.DateTimeFormat("es-PE", {
                timeZone: "America/Lima",
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </p>
            {todayMeetings.length === 0 ? (
              <p className="py-8 text-[13px] text-[var(--auth-text-muted)]">No hay reuniones para hoy.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {todayMeetings.map((meeting) => (
                  <li key={meeting.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(meeting.id);
                        setMeetUrl(meeting.meetUrl ?? "");
                        setAdvisorEmail(meeting.advisorEmail ?? "");
                      }}
                      className="w-full rounded-xl border border-[var(--auth-input-border)] px-3 py-2 text-left hover:border-[var(--auth-accent)]/40"
                    >
                      <p className="text-[12px] font-bold tabular-nums text-[var(--auth-accent)]">
                        {formatMinute(limaParts(new Date(meeting.startsAt)).minuteOfDay)}
                      </p>
                      <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">{meeting.requesterName}</p>
                      <p className="truncate text-[12px] text-[var(--auth-text-muted)]">
                        {meeting.advisorName ?? "Sin asesor"} · {TYPE_LABEL[meeting.meetingType]}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {editing ? (
          <ScheduleEditor
            schedule={editing}
            saving={saving}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={() => void saveSchedule()}
          />
        ) : null}

        <section className="dashboard-surface-card overflow-hidden rounded-[1.15rem]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--auth-divider)] px-4 py-3">
            <h2 className="mr-auto text-[14px] font-bold text-[var(--auth-text)]">Seguimiento</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente o asunto"
              className="h-9 w-full rounded-lg border border-[var(--auth-input-border)] px-3 text-[13px] sm:w-56"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-lg border border-[var(--auth-input-border)] bg-white px-2 text-[13px]"
            >
              <option value="all">Todos los estados</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 rounded-lg border border-[var(--auth-input-border)] bg-white px-2 text-[13px]"
            >
              <option value="all">Todos los tipos</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-[12px]">
                <thead className="bg-[#faf9f7] text-[11px] uppercase tracking-[0.06em] text-[var(--auth-text-soft)]">
                  <tr>
                    {["Fecha", "Cliente", "Asesor", "Asunto", "Tipo", "Estado"].map((heading) => (
                      <th key={heading} className="px-3 py-2 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-[var(--auth-text-muted)]">
                        No hay reuniones con ese filtro.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((meeting) => (
                      <tr
                        key={meeting.id}
                        onClick={() => {
                          setSelectedId(meeting.id);
                          setMeetUrl(meeting.meetUrl ?? "");
                          setAdvisorEmail(meeting.advisorEmail ?? schedules.find((item) => item.isAvailable)?.email ?? "");
                          setMoving(false);
                        }}
                        className={cn(
                          "cursor-pointer border-t border-[var(--auth-divider)]",
                          selectedId === meeting.id ? "bg-[rgb(255_120_31_/_0.08)]" : "hover:bg-white",
                        )}
                      >
                        <td className="px-3 py-2.5 capitalize text-[var(--auth-text)]">{whenLabel(meeting.startsAt)}</td>
                        <td className="px-3 py-2.5 font-semibold text-[var(--auth-text)]">{meeting.requesterName}</td>
                        <td className="px-3 py-2.5 text-[var(--auth-text-muted)]">{meeting.advisorName ?? "—"}</td>
                        <td className="max-w-[12rem] truncate px-3 py-2.5 text-[var(--auth-text)]">{meeting.subject}</td>
                        <td className="px-3 py-2.5 text-[var(--auth-text-muted)]">{TYPE_LABEL[meeting.meetingType]}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", statusClass(meeting.status))}>
                            {STATUS_LABEL[meeting.status]}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--auth-divider)] p-4 xl:border-l xl:border-t-0">
              {selected ? (
                <Detail
                  meeting={selected}
                  schedules={schedules}
                  saving={saving}
                  moving={moving}
                  slotStart={slotStart}
                  slotChoices={slotChoices}
                  meetUrl={meetUrl}
                  advisorEmail={advisorEmail}
                  onMeetUrl={setMeetUrl}
                  onAdvisor={setAdvisorEmail}
                  onMoveToggle={() => {
                    setMoving((value) => !value);
                    setSlotStart("");
                    setSlotChoices([]);
                  }}
                  onPickSlot={setSlotStart}
                  onConfirm={() =>
                    void runAction({
                      action: "confirm",
                      meetUrl,
                      advisorEmail,
                    })
                  }
                  onReschedule={() =>
                    void runAction({
                      action: "reschedule",
                      meetUrl,
                      advisorEmail,
                      startsAt: slotStart,
                    })
                  }
                  onStatus={(action) => void runAction({ action })}
                />
              ) : (
                <p className="py-8 text-center text-[13px] text-[var(--auth-text-muted)]">
                  Elige una reunión para confirmarla, reprogramarla o enviar el recordatorio.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="dashboard-surface-card rounded-xl px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--auth-text-soft)]">{label}</p>
      <p className="mt-1 text-[20px] font-bold tracking-[-0.03em] text-[var(--auth-text)]">{value}</p>
      <p className="text-[11px] text-[var(--auth-text-muted)]">{detail}</p>
    </article>
  );
}

function WeekHour({
  hour,
  days,
  cellsByKey,
  onPick,
}: {
  hour: number;
  days: string[];
  cellsByKey: Map<string, HourCell>;
  onPick: (cell: HourCell) => void;
}) {
  return (
    <>
      <span className="flex items-center text-[10px] tabular-nums text-[var(--auth-text-soft)]">{formatMinute(hour)}</span>
      {days.map((day) => {
        const cell = cellsByKey.get(`${day}-${hour}`);
        const kind = cell?.kind ?? "off";
        return (
          <button
            key={day}
            type="button"
            disabled={kind !== "free"}
            onClick={() => cell && onPick(cell)}
            className={cn("h-8 rounded-md text-[9px] font-semibold", cellClass(kind))}
          >
            {kind === "free" ? "Libre" : kind === "break" ? "Pausa" : kind === "full" ? "Lleno" : ""}
          </button>
        );
      })}
    </>
  );
}

function ScheduleEditor({
  schedule,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  schedule: ScheduleDto;
  saving: boolean;
  onChange: (schedule: ScheduleDto) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const options: number[] = [];
  for (let minute = 7 * 60; minute <= 21 * 60; minute += 30) options.push(minute);
  return (
    <section className="dashboard-surface-card rounded-[1.15rem] p-4">
      <h2 className="text-[14px] font-bold text-[var(--auth-text)]">Editar horario de {schedule.displayName}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {DAY_NAMES.map((name, index) => {
          const bit = 1 << index;
          const on = (schedule.weekdayMask & bit) !== 0;
          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                const next = schedule.weekdayMask ^ bit;
                if (next === 0) return;
                onChange({ ...schedule, weekdayMask: next });
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold",
                on ? "bg-[var(--brand-primary)] text-white" : "bg-[var(--surface-soft)] text-[var(--auth-text-muted)]",
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <MinuteField
          label="Desde"
          value={schedule.startMinute}
          options={options}
          onChange={(startMinute) => onChange({ ...schedule, startMinute })}
        />
        <MinuteField
          label="Hasta"
          value={schedule.endMinute}
          options={options}
          onChange={(endMinute) => onChange({ ...schedule, endMinute })}
        />
        <MinuteField
          label="Descanso desde"
          value={schedule.breakStartMinute}
          options={options}
          onChange={(breakStartMinute) => onChange({ ...schedule, breakStartMinute })}
        />
        <MinuteField
          label="Descanso hasta"
          value={schedule.breakEndMinute}
          options={options}
          onChange={(breakEndMinute) => onChange({ ...schedule, breakEndMinute })}
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--auth-text)]">
        <input
          type="checkbox"
          checked={schedule.isAvailable}
          onChange={(event) => onChange({ ...schedule, isAvailable: event.target.checked })}
        />
        Disponible para nuevas reuniones
      </label>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          Guardar horario
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg px-3 text-[13px] font-semibold text-[var(--auth-text-muted)]">
          Cerrar
        </button>
      </div>
    </section>
  );
}

function MinuteField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-[12px] font-semibold text-[var(--auth-text)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 h-10 w-full rounded-lg border border-[var(--auth-input-border)] bg-white px-2 text-[13px]"
      >
        {options.map((minute) => (
          <option key={minute} value={minute}>
            {formatMinute(minute)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Detail({
  meeting,
  schedules,
  saving,
  moving,
  slotStart,
  slotChoices,
  meetUrl,
  advisorEmail,
  onMeetUrl,
  onAdvisor,
  onMoveToggle,
  onPickSlot,
  onConfirm,
  onReschedule,
  onStatus,
}: {
  meeting: MeetingDto;
  schedules: ScheduleDto[];
  saving: boolean;
  moving: boolean;
  slotStart: string;
  slotChoices: { startsAt: string; minute: number }[];
  meetUrl: string;
  advisorEmail: string;
  onMeetUrl: (value: string) => void;
  onAdvisor: (value: string) => void;
  onMoveToggle: () => void;
  onPickSlot: (startsAt: string) => void;
  onConfirm: () => void;
  onReschedule: () => void;
  onStatus: (action: string) => void;
}) {
  const closed = meeting.status === "completed" || meeting.status === "cancelled" || meeting.status === "no_show";
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold text-[var(--auth-text)]">{meeting.subject}</h3>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", statusClass(meeting.status))}>
          {STATUS_LABEL[meeting.status]}
        </span>
      </div>
      <dl className="space-y-1.5 text-[13px]">
        <Info label="Cliente" value={`${meeting.requesterName} · ${meeting.requesterEmail}`} />
        <Info label="Teléfono" value={meeting.requesterPhone || "No dejó teléfono"} />
        <Info label="Cuándo" value={whenLabel(meeting.startsAt)} />
        <Info label="Tipo" value={TYPE_LABEL[meeting.meetingType] ?? meeting.meetingType} />
        <Info label="Asesor" value={meeting.advisorName ?? "Por asignar"} />
        <Info label="Canal" value="Google Meet" />
        <Info label="Recordatorio cliente" value={meeting.clientReminderSent ? "Enviado" : "Pendiente"} />
        <Info label="Recordatorio asesor" value={meeting.advisorReminderSent ? "Enviado" : "Pendiente"} />
      </dl>
      {meeting.notes ? (
        <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-[13px]">{meeting.notes}</p>
      ) : null}
      {meeting.meetUrl ? (
        <a href={meeting.meetUrl} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-emerald-700">
          Abrir Meet
        </a>
      ) : null}
      {!closed ? (
        <div className="space-y-2 border-t border-[var(--auth-divider)] pt-3">
          <label className="block text-[12px] font-semibold">
            Asesor
            <select
              value={advisorEmail}
              onChange={(event) => onAdvisor(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[var(--auth-input-border)] bg-white px-2 text-[13px]"
            >
              <option value="">Elegir</option>
              {schedules
                .filter((item) => item.isAvailable)
                .map((item) => (
                  <option key={item.email} value={item.email}>
                    {item.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-[12px] font-semibold">
            Enlace de la reunión
            <input
              value={meetUrl}
              onChange={(event) => onMeetUrl(event.target.value)}
              placeholder="https://meet.google.com/..."
              className="mt-1 h-10 w-full rounded-lg border border-[var(--auth-input-border)] px-3 text-[13px]"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="h-10 w-full rounded-lg bg-emerald-600 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            Confirmar
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={saving} onClick={onMoveToggle} className="h-9 rounded-lg border text-[12px] font-semibold">
              Reprogramar
            </button>
            <button type="button" disabled={saving} onClick={() => onStatus("remind")} className="h-9 rounded-lg border text-[12px] font-semibold">
              Recordatorio
            </button>
            <button type="button" disabled={saving} onClick={() => onStatus("complete")} className="h-9 rounded-lg border text-[12px] font-semibold">
              Completar
            </button>
            <button type="button" disabled={saving} onClick={() => onStatus("no_show")} className="h-9 rounded-lg border text-[12px] font-semibold text-rose-700">
              No show
            </button>
          </div>
          {moving ? (
            <div className="space-y-2">
              {slotChoices.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {slotChoices.map((choice) => (
                    <button
                      key={choice.startsAt}
                      type="button"
                      onClick={() => onPickSlot(choice.startsAt)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[12px] font-bold tabular-nums",
                        slotStart === choice.startsAt
                          ? "bg-[var(--brand-primary)] text-white"
                          : "bg-white text-[var(--auth-text)] ring-1 ring-black/10",
                      )}
                    >
                      {formatMinute(choice.minute)}
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                disabled={saving || !slotStart}
                onClick={onReschedule}
                className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {slotStart ? `Mover a ${whenLabel(slotStart)}` : slotChoices.length > 1 ? "Elige :00 o :30" : "Elige un bloque verde"}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (window.confirm("¿Cancelar esta reunión?")) onStatus("cancel");
            }}
            className="h-9 w-full text-[12px] font-semibold text-rose-700"
          >
            Cancelar reunión
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--auth-text-soft)]">{label}</dt>
      <dd className="font-medium text-[var(--auth-text)]">{value}</dd>
    </div>
  );
}
