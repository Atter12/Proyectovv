"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";

const WEEKDAYS = ["Do.", "Lu.", "Ma.", "Mi.", "Ju.", "Vi.", "Sá."] as const;

const MONTHS_ES = [
  "Ene.",
  "Feb.",
  "Mar.",
  "Abr.",
  "May.",
  "Jun.",
  "Jul.",
  "Ago.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dic.",
] as const;

type PresetId = "all" | "7d" | "14d" | "30d" | "custom";

type Preset = {
  id: PresetId;
  label: string;
  days?: number;
};

const PRESETS: Preset[] = [
  { id: "all", label: "Todo el historial" },
  { id: "7d", label: "Últimos 7 días", days: 7 },
  { id: "14d", label: "Últimos 14 días", days: 14 },
  { id: "30d", label: "Últimos 30 días", days: 30 },
];

function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(ymd: string, delta: number): string {
  const date = parseYmd(ymd);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return formatYmd(date);
}

function monthStart(ymd: string): string {
  const [y, m] = ymd.split("-");
  return `${y}-${m}-01`;
}

function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

function buildMonthGrid(monthYmd: string): Array<{ ymd: string; inMonth: boolean }> {
  const date = parseYmd(monthYmd);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<{ ymd: string; inMonth: boolean }> = [];

  for (let i = 0; i < startOffset; i += 1) {
    const d = new Date(Date.UTC(year, month, 1 - (startOffset - i)));
    cells.push({ ymd: formatYmd(d), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(Date.UTC(year, month, day));
    cells.push({ ymd: formatYmd(d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = parseYmd(cells[cells.length - 1].ymd);
    last.setUTCDate(last.getUTCDate() + 1);
    cells.push({ ymd: formatYmd(last), inMonth: false });
  }
  while (cells.length < 42) {
    const last = parseYmd(cells[cells.length - 1].ymd);
    last.setUTCDate(last.getUTCDate() + 1);
    cells.push({ ymd: formatYmd(last), inMonth: false });
  }
  return cells;
}

function isBetween(ymd: string, start: string, end: string): boolean {
  const lo = start <= end ? start : end;
  const hi = start <= end ? end : start;
  return ymd >= lo && ymd <= hi;
}

function monthLabel(ymd: string): string {
  const date = parseYmd(ymd);
  return `${date.getUTCFullYear()} ${MONTHS_ES[date.getUTCMonth()]}`;
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[15px] font-medium text-[var(--auth-text-muted)] transition-colors hover:bg-[var(--auth-bg)] hover:text-[var(--auth-text)]"
    >
      {children}
    </button>
  );
}

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  minDate?: string | null;
  maxDate?: string | null;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  className,
}: DateRangePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [anchorMonth, setAnchorMonth] = useState(monthStart(startDate));
  const [pickingEnd, setPickingEnd] = useState(false);
  const today = useMemo(() => todayYmdInTz(), []);

  useEffect(() => {
    if (!open) {
      setDraftStart(startDate);
      setDraftEnd(endDate);
      setPickingEnd(false);
      return;
    }
    setAnchorMonth(monthStart(startDate));
  }, [open, startDate, endDate]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (!open) return;
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const leftMonth = anchorMonth;
  const rightMonth = addMonths(anchorMonth, 1);

  function applyPreset(preset: Preset) {
    if (preset.id === "all") {
      if (minDate && maxDate) {
        onChange(minDate, maxDate);
        setOpen(false);
      }
      return;
    }
    if (!preset.days) return;
    const end = maxDate && maxDate < today ? maxDate : today;
    const start = shiftYmd(end, -(preset.days - 1));
    const boundedStart = minDate && start < minDate ? minDate : start;
    onChange(boundedStart, end);
    setOpen(false);
  }

  function handleDayClick(ymd: string) {
    if (minDate && ymd < minDate) return;
    if (maxDate && ymd > maxDate) return;

    if (!pickingEnd) {
      setDraftStart(ymd);
      setDraftEnd(ymd);
      setPickingEnd(true);
      return;
    }

    let nextStart = draftStart;
    let nextEnd = ymd;
    if (ymd < draftStart) {
      nextStart = ymd;
      nextEnd = draftStart;
    }
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setPickingEnd(false);
    onChange(nextStart, nextEnd);
    setOpen(false);
  }

  function renderMonth(monthYmd: string) {
    const cells = buildMonthGrid(monthYmd);
    return (
      <div className="min-w-[220px] flex-1">
        <p className="mb-2 text-center text-[12px] font-semibold text-[var(--auth-text)] sm:hidden">
          {monthLabel(monthYmd)}
        </p>
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((day) => (
            <span
              key={`${monthYmd}-${day}`}
              className="py-1 text-center text-[10px] font-medium text-[var(--auth-text-soft)]"
            >
              {day}
            </span>
          ))}
          {cells.map((cell) => {
            const selected = cell.ymd === draftStart || cell.ymd === draftEnd;
            const inRange =
              draftStart && draftEnd && isBetween(cell.ymd, draftStart, draftEnd);
            const disabled =
              (minDate != null && cell.ymd < minDate) ||
              (maxDate != null && cell.ymd > maxDate);

            return (
              <button
                key={`${monthYmd}-${cell.ymd}`}
                type="button"
                disabled={disabled}
                onClick={() => handleDayClick(cell.ymd)}
                className={cn(
                  "relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors",
                  !cell.inMonth && "text-[var(--auth-text-soft)]/70",
                  cell.inMonth && !disabled && "text-[var(--auth-text)]",
                  disabled && "cursor-not-allowed opacity-35",
                  inRange &&
                    !selected &&
                    "bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]",
                  selected && "bg-[var(--auth-accent)] font-semibold text-white",
                  !selected && !inRange && !disabled && "hover:bg-[var(--auth-bg)]",
                )}
              >
                {Number(cell.ymd.slice(8, 10))}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const displayRange = `${startDate} ~ ${endDate}`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--auth-border)] bg-white px-3 text-left text-[12px] font-medium text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)]/35 hover:bg-[var(--auth-bg)]"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="truncate tabular-nums">{displayRange}</span>
        <svg
          className="h-4 w-4 shrink-0 text-[var(--auth-text-soft)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 9.75h18M4.5 19.5h15a1.5 1.5 0 001.5-1.5V6.75A1.5 1.5 0 0019.5 5.25h-15A1.5 1.5 0 003 6.75v11.25A1.5 1.5 0 004.5 19.5z"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Seleccionar rango de fechas"
          className="absolute right-0 z-[60] mt-2 w-[min(100vw-1.5rem,640px)] overflow-hidden rounded-xl border border-[var(--auth-border)] bg-white shadow-[0_18px_40px_rgb(28_25_23_/_0.14)]"
        >
          <div className="flex flex-col sm:flex-row">
            <div className="border-b border-[var(--auth-divider)] p-2 sm:w-[148px] sm:border-b-0 sm:border-r">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-[12px] font-medium text-[var(--auth-text-muted)] transition-colors hover:bg-[var(--auth-bg)] hover:text-[var(--auth-text)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="min-w-0 flex-1 p-3">
              <div className="mb-3 flex items-center justify-between gap-1">
                <div className="flex items-center gap-0.5">
                  <NavButton
                    label="Año anterior"
                    onClick={() => setAnchorMonth(addMonths(anchorMonth, -12))}
                  >
                    «
                  </NavButton>
                  <NavButton
                    label="Mes anterior"
                    onClick={() => setAnchorMonth(addMonths(anchorMonth, -1))}
                  >
                    ‹
                  </NavButton>
                </div>

                <p className="hidden px-2 text-center text-[12px] font-semibold text-[var(--auth-text)] sm:block">
                  {monthLabel(leftMonth)}
                  {monthKey(leftMonth) !== monthKey(rightMonth)
                    ? ` · ${monthLabel(rightMonth)}`
                    : ""}
                </p>

                <div className="flex items-center gap-0.5">
                  <NavButton
                    label="Mes siguiente"
                    onClick={() => setAnchorMonth(addMonths(anchorMonth, 1))}
                  >
                    ›
                  </NavButton>
                  <NavButton
                    label="Año siguiente"
                    onClick={() => setAnchorMonth(addMonths(anchorMonth, 12))}
                  >
                    »
                  </NavButton>
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
                {renderMonth(leftMonth)}
                <div className="hidden sm:block">
                  {monthKey(leftMonth) !== monthKey(rightMonth)
                    ? renderMonth(rightMonth)
                    : null}
                </div>
              </div>

              <p className="mt-3 text-[11px] text-[var(--auth-text-muted)]">
                {pickingEnd
                  ? "Elegí la fecha final del rango."
                  : "Elegí la fecha inicial y luego la final."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
