"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";
import { SEEDED_ADVISORS } from "@/features/support/lib/meeting-slots";
import type { MeetingDto } from "@/features/support/lib/meeting-types";

const OPEN = new Set(["pending", "confirmed", "rescheduled"]);
const ADVISORS = new Set(SEEDED_ADVISORS.map((item) => item.email));

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  rescheduled: "Reprogramada",
};

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
  return "bg-orange-50 text-orange-800";
}

/**
 * Agenda personal de las cuatro personas de soporte.
 * Vive en la capa flotante del panel para verla desde cualquier módulo.
 */
export function StaffCalendarFab() {
  const pathname = usePathname();
  const needsStickyLift =
    pathname === routes.payments ||
    pathname.startsWith(`${routes.payments}/`) ||
    pathname === routes.adAccounts ||
    pathname.startsWith(`${routes.adAccounts}/`);
  const [open, setOpen] = useState(false);
  const [gate, setGate] = useState<"unknown" | "advisor" | "skip">("unknown");
  const [meetings, setMeetings] = useState<MeetingDto[]>([]);

  useEffect(() => {
    if (gate === "skip") return;
    let stop = false;
    async function load() {
      try {
        const res = await fetch("/api/support/meetings", { credentials: "include", cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          viewerEmail?: string;
          meetings?: MeetingDto[];
        };
        if (stop || !res.ok || !data.ok) return;
        const email = data.viewerEmail?.trim().toLowerCase() ?? "";
        if (!ADVISORS.has(email)) {
          setGate("skip");
          return;
        }
        setGate("advisor");
        const mine = (data.meetings ?? [])
          .filter(
            (meeting) =>
              meeting.advisorEmail?.toLowerCase() === email &&
              OPEN.has(meeting.status) &&
              Date.parse(meeting.endsAt) > Date.now(),
          )
          .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
        setMeetings(mine);
      } catch {
        // La agenda vuelve a intentar en el siguiente ciclo.
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [gate]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (gate !== "advisor") return null;

  const next = meetings[0];

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-3 z-50 flex max-w-[min(22rem,calc(100vw-1.5rem))] flex-col items-end gap-2 sm:right-5 md:bottom-6 md:right-6",
        needsStickyLift ? "bottom-[4.75rem] sm:bottom-[5.25rem] md:bottom-6" : "bottom-3 sm:bottom-5",
      )}
    >
      {open ? (
        <div className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-2xl shadow-black/15">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[rgb(255_120_31_/_0.08)] px-3 py-2.5">
            <div>
              <p className="text-[13px] font-bold text-[var(--auth-text)]">Tus citas</p>
              <p className="text-[11px] text-[var(--auth-text-muted)]">Hora de Lima</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--auth-text-muted)] hover:bg-black/5"
            >
              Cerrar
            </button>
          </div>
          {meetings.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] leading-relaxed text-[var(--auth-text-muted)]">
              Nadie te sacó cita todavía.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {meetings.map((meeting) => (
                <li key={meeting.id} className="border-b border-[var(--border-subtle)] px-3 py-2.5 last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold capitalize text-[var(--auth-text)]">
                      {whenLabel(meeting.startsAt)}
                    </p>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", statusClass(meeting.status))}>
                      {STATUS_LABEL[meeting.status] ?? meeting.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] font-semibold text-[var(--auth-text)]">
                    {meeting.requesterName}
                  </p>
                  <p className="truncate text-[12px] text-[var(--auth-text-muted)]">{meeting.subject}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={routes.support}
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--border-subtle)] bg-[var(--brand-primary)] px-3 py-2.5 text-center text-[12px] font-bold text-white hover:bg-[var(--brand-primary-deep)]"
          >
            Abrir agenda
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          meetings.length === 0
            ? "Tus citas de soporte"
            : `${meetings.length} citas. La próxima es ${next ? whenLabel(next.startsAt) : ""}`
        }
        className="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-primary)] text-white shadow-xl shadow-[rgb(255_120_31_/_0.4)] transition-transform hover:scale-[1.03]"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 5.25h15a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75V6a.75.75 0 01.75-.75z" />
        </svg>
        {meetings.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-[var(--brand-primary)]">
            {meetings.length > 9 ? "9+" : meetings.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}
