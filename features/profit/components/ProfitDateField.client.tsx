"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["do", "lu", "ma", "mi", "ju", "vi", "sá"] as const;
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
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
  if (!p) return "Elegir fecha";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function clampYmd(ymd: string, min?: string, max?: string): string {
  if (min && ymd < min) return min;
  if (max && ymd > max) return max;
  return ymd;
}

type ProfitDateFieldProps = {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (ymd: string) => void;
};

export function ProfitDateField({
  label,
  value,
  min,
  max,
  onChange,
}: ProfitDateFieldProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = parseYmd(value);
  const initialView = selected ?? parseYmd(max ?? "") ?? parseYmd(min ?? "") ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth() + 1,
    d: 1,
  };
  const [viewY, setViewY] = useState(initialView.y);
  const [viewM, setViewM] = useState(initialView.m);

  useEffect(() => {
    if (!open) return;
    const p = parseYmd(value);
    if (p) {
      setViewY(p.y);
      setViewM(p.m);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
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
  }, [viewY, viewM, min, max]);

  function shiftMonth(delta: number) {
    let m = viewM + delta;
    let y = viewY;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewY(y);
    setViewM(m);
  }

  function pick(ymd: string) {
    onChange(clampYmd(ymd, min, max));
    setOpen(false);
  }

  function goToday() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const preferred = max && max <= todayIso ? max : todayIso;
    const clamped = clampYmd(preferred, min, max);
    const p = parseYmd(clamped);
    if (p) {
      setViewY(p.y);
      setViewM(p.m);
    }
    pick(clamped);
  }

  return (
    <div ref={rootRef} className="relative block">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
        {label}
      </span>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3.5 text-left text-[13px] font-medium tabular-nums text-[#1c1917] outline-none transition hover:border-[#cfc6bb] hover:bg-white focus:border-[#cfc6bb] focus:bg-white focus:ring-2 focus:ring-[#ff781f]/25"
      >
        <span>{formatDisplay(value)}</span>
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
          aria-label={`Calendario ${label}`}
          className="absolute left-0 z-40 mt-2 w-[min(100%,18.5rem)] rounded-2xl border border-[#ece7e0] bg-white p-3 shadow-[0_18px_40px_-24px_rgb(28_25_23_/_0.55)]"
        >
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-[13px] font-semibold capitalize text-[#1c1917]">
              {MONTHS[viewM - 1]} de {viewY}
            </p>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => shiftMonth(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-[#f3efe9]"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => shiftMonth(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5c564e] transition hover:bg-[#f3efe9]"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#9a9187]"
              >
                {d}
              </span>
            ))}
            {cells.map((cell) => {
              const isSelected = cell.ymd === value;
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  disabled={cell.disabled}
                  onClick={() => pick(cell.ymd)}
                  className={`h-9 rounded-lg text-[12px] font-semibold tabular-nums transition ${
                    isSelected
                      ? "bg-[#ff781f] text-white shadow-[0_6px_14px_-6px_rgb(255_120_31_/_0.8)]"
                      : cell.inMonth
                        ? "text-[#1c1917] hover:bg-[#fff1e8]"
                        : "text-[#c4bbb2] hover:bg-[#faf8f5]"
                  } ${cell.disabled ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[#f0ebe4] pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#8a8177] transition hover:bg-[#faf8f5] hover:text-[#1c1917]"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#c2410c] transition hover:bg-[#fff7f0]"
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
