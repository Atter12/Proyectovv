"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildMonthGrid } from "@/features/alliances/lib/followup";
import { dueHint, formatAllianceDate } from "@/features/alliances/lib/domain";
import type { CalendarEventView } from "@/features/alliances/lib/view";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function AllianceCalendar({
  today,
  events,
  basePath,
}: {
  today: string;
  events: CalendarEventView[];
  basePath: string;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEventView[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);
  const visible = byDate.get(selected) ?? [];
  const title = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

  function shift(delta: number) {
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, (monthNumber || 1) - 1 + delta, 1));
    const value = next.toISOString().slice(0, 7);
    setMonth(value);
    setSelected(`${value}-01`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg capitalize text-[var(--admin-text)]">{title}</h2>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-sm text-[var(--admin-text)]" onClick={() => shift(-1)}>
              Anterior
            </button>
            <button type="button" className="rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-sm text-[var(--admin-text)]" onClick={() => shift(1)}>
              Siguiente
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--admin-text-soft)]">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">{day}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const count = byDate.get(cell.date)?.length ?? 0;
            const active = cell.date === selected;
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelected(cell.date)}
                className={`min-h-14 rounded-lg border px-1 py-1 text-left text-xs ${
                  active
                    ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]"
                    : "border-transparent hover:border-[var(--admin-border)]"
                } ${cell.date === today ? "ring-1 ring-[var(--admin-accent)]" : ""} ${cell.inMonth ? "text-[var(--admin-text)]" : "text-[var(--admin-text-soft)]"}`}
              >
                <span>{Number(cell.date.slice(8))}</span>
                {count > 0 ? <span className="mt-1 block truncate text-[10px] font-semibold text-[var(--admin-accent)]">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </section>
      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)]">
        <h2 className="font-display text-lg text-[var(--admin-text)]">{formatAllianceDate(selected)}</h2>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{dueHint(selected, today)}</p>
        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--admin-text-muted)]">Este día no tiene vencimientos ni seguimientos.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {visible.map((event) => (
              <li key={`${event.kind}-${event.id}`}>
                <Link href={`${basePath}/${event.allianceId}`} className="block rounded-lg border border-[var(--admin-border)] p-3 hover:bg-[var(--admin-surface-hover)]">
                  <p className={event.overdue ? "font-medium text-[var(--admin-danger)]" : "font-medium text-[var(--admin-text)]"}>{event.title}</p>
                  <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                    {event.allianceName} · {event.kind === "expiry" ? "Vencimiento" : "Seguimiento"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
