"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["do", "lu", "ma", "mi", "ju", "vi", "sá"] as const;
const MONTHS_SHORT = [
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

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDisplay(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return "—";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

function monthCells(
  viewY: number,
  viewM: number,
  min?: string,
  max?: string,
): Array<{ ymd: string; day: number; inMonth: boolean; disabled: boolean }> {
  const firstDow = new Date(Date.UTC(viewY, viewM - 1, 1)).getUTCDay();
  const dim = daysInMonth(viewY, viewM);
  const prevDim = daysInMonth(viewY, viewM === 1 ? 12 : viewM - 1);
  const out: Array<{
    ymd: string;
    day: number;
    inMonth: boolean;
    disabled: boolean;
  }> = [];

  for (let i = 0; i < 42; i++) {
    let y = viewY;
    let m = viewM;
    let d: number;
    let inMonth = true;
    if (i < firstDow) {
      inMonth = false;
      d = prevDim - firstDow + i + 1;
      if (viewM === 1) {
        y = viewY - 1;
        m = 12;
      } else {
        m = viewM - 1;
      }
    } else if (i >= firstDow + dim) {
      inMonth = false;
      d = i - firstDow - dim + 1;
      if (viewM === 12) {
        y = viewY + 1;
        m = 1;
      } else {
        m = viewM + 1;
      }
    } else {
      d = i - firstDow + 1;
    }
    const ymd = toYmd(y, m, d);
    const disabled = Boolean((min && ymd < min) || (max && ymd > max));
    out.push({ ymd, day: d, inMonth, disabled });
  }
  return out;
}

type ProfitDateRangeFieldProps = {
  from: string;
  to: string;
  max?: string;
  onChange: (next: { from: string; to: string }) => void;
};

export function ProfitDateRangeField({
  from,
  to,
  max,
  onChange,
}: ProfitDateRangeFieldProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);

  const initial = parseYmd(from) ?? parseYmd(to) ?? parseYmd(max ?? "") ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth() + 1,
    d: 1,
  };
  const [leftY, setLeftY] = useState(initial.y);
  const [leftM, setLeftM] = useState(initial.m);

  const right = addMonths(leftY, leftM, 1);

  useEffect(() => {
    if (!open) return;
    const p = parseYmd(from) ?? parseYmd(to);
    if (p) {
      setLeftY(p.y);
      setLeftM(p.m);
    }
    setDraftStart(null);
    setHoverYmd(null);
  }, [open, from, to]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setDraftStart(null);
        setHoverYmd(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setDraftStart(null);
        setHoverYmd(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const leftCells = useMemo(
    () => monthCells(leftY, leftM, undefined, max),
    [leftY, leftM, max],
  );
  const rightCells = useMemo(
    () => monthCells(right.y, right.m, undefined, max),
    [right.y, right.m, max],
  );

  const rangeStart = draftStart ?? from;
  const rangeEnd = draftStart
    ? hoverYmd && hoverYmd !== draftStart
      ? hoverYmd
      : draftStart
    : to;

  const displayFrom =
    draftStart && rangeEnd && rangeEnd < draftStart ? rangeEnd : rangeStart;
  const displayTo =
    draftStart && rangeEnd && rangeEnd < draftStart ? rangeStart : rangeEnd;

  function shiftLeft(delta: number) {
    const next = addMonths(leftY, leftM, delta);
    setLeftY(next.y);
    setLeftM(next.m);
  }

  function pick(ymd: string) {
    if (!draftStart) {
      setDraftStart(ymd);
      setHoverYmd(ymd);
      return;
    }
    let nextFrom = draftStart;
    let nextTo = ymd;
    if (nextTo < nextFrom) {
      nextFrom = ymd;
      nextTo = draftStart;
    }
    onChange({ from: nextFrom, to: nextTo });
    setDraftStart(null);
    setHoverYmd(null);
    setOpen(false);
  }

  function clearRange() {
    setDraftStart(null);
    setHoverYmd(null);
    onChange({ from: "", to: "" });
  }

  function goToday() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const today = max && max < todayIso ? max : todayIso;
    onChange({ from: today, to: today });
    setDraftStart(null);
    setHoverYmd(null);
    setOpen(false);
  }

  function dayClass(cell: {
    ymd: string;
    inMonth: boolean;
    disabled: boolean;
  }): string {
    const isStart = Boolean(displayFrom && cell.ymd === displayFrom);
    const isEnd = Boolean(displayTo && cell.ymd === displayTo);
    const inRange =
      Boolean(displayFrom && displayTo) &&
      cell.ymd > displayFrom &&
      cell.ymd < displayTo;
    const isEdge = isStart || isEnd;

    if (cell.disabled) {
      return "cursor-not-allowed text-[#d4cbc2] opacity-40";
    }
    if (isEdge) {
      return "bg-[var(--auth-accent)] text-white hover:brightness-[1.05]";
    }
    if (inRange) {
      return "bg-[#fff1e8] text-[#1c1917] hover:bg-[#ffe4d1]";
    }
    if (cell.inMonth) {
      return "text-[#1c1917] hover:bg-[#faf8f5]";
    }
    return "text-[#c4bbb2] hover:bg-[#faf8f5]";
  }

  function MonthGrid({
    y,
    m,
    cells,
  }: {
    y: number;
    m: number;
    cells: ReturnType<typeof monthCells>;
  }) {
    return (
      <div className="min-w-[15.5rem]">
        <p className="px-1 pb-2 text-center text-[12px] font-semibold text-[#1c1917]">
          Año {y} {MONTHS_SHORT[m - 1]}
        </p>
        <div className="grid grid-cols-7 gap-y-0.5">
          {WEEKDAYS.map((d) => (
            <span
              key={`${y}-${m}-${d}`}
              className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#9a9187]"
            >
              {d}.
            </span>
          ))}
          {cells.map((cell) => (
            <button
              key={`${y}-${m}-${cell.ymd}-${cell.inMonth ? "in" : "out"}`}
              type="button"
              disabled={cell.disabled}
              onClick={() => pick(cell.ymd)}
              onMouseEnter={() => {
                if (draftStart && !cell.disabled) setHoverYmd(cell.ymd);
              }}
              className={`h-8 text-[12px] font-semibold tabular-nums transition ${dayClass(cell)}`}
            >
              {cell.day}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selecting = Boolean(draftStart);

  return (
    <div ref={rootRef} className="relative block w-full max-w-md">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
        Rango
      </span>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`mt-1.5 flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-[#faf8f5] px-3.5 text-left text-[13px] font-medium tabular-nums text-[#1c1917] outline-none transition hover:bg-white focus:bg-white focus:ring-2 focus:ring-[var(--auth-accent)]/25 ${
          open
            ? "border-[var(--auth-accent)] bg-white"
            : "border-[#e7e0d8] hover:border-[#cfc6bb]"
        }`}
      >
        <span>
          {from && to
            ? `${formatDisplay(from)} ~ ${formatDisplay(to)}`
            : "Elegir rango de fechas"}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0 text-[#8a8177]"
          fill="none"
        >
          <path
            d="M6 2.5v2M14 2.5v2M3.5 7h13M4.5 4.5h11A1.5 1.5 0 0 1 17 6v9.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Elegir rango de fechas"
          className="absolute left-0 z-40 mt-2 w-[min(100vw-2rem,36rem)] rounded-2xl border border-[#ece7e0] bg-white p-3 shadow-[0_18px_40px_-24px_rgb(28_25_23_/_0.55)] sm:p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Año anterior"
                onClick={() => shiftLeft(-12)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-[#f3efe9]"
              >
                «
              </button>
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => shiftLeft(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-[#f3efe9]"
              >
                ‹
              </button>
            </div>
            <p className="text-[11px] font-medium text-[#8a8177]">
              {selecting
                ? "Elegí la fecha final del rango"
                : "Elegí inicio y luego el fin"}
            </p>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => shiftLeft(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-[#f3efe9]"
              >
                ›
              </button>
              <button
                type="button"
                aria-label="Año siguiente"
                onClick={() => shiftLeft(12)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-[#f3efe9]"
              >
                »
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
            <MonthGrid y={leftY} m={leftM} cells={leftCells} />
            <div className="hidden w-px self-stretch bg-[#f0ebe4] sm:block" />
            <MonthGrid y={right.y} m={right.m} cells={rightCells} />
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#f0ebe4] pt-2">
            <button
              type="button"
              onClick={clearRange}
              className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#8a8177] transition hover:bg-[#faf8f5] hover:text-[#1c1917]"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[var(--auth-accent)] transition hover:bg-[#fff7f0]"
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
