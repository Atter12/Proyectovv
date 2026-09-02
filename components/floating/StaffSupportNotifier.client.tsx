"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";
import { playSupportNotifySound } from "@/lib/support/notify-sound.client";

interface InboxTicketLite {
  id: string;
  status: string;
  hasTicket?: boolean;
  requesterDisplayName?: string;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string;
  lastMessageFromClient?: boolean;
}

/**
 * Aviso flotante (izquierda) para gerentes fuera de /support:
 * badge + preview + sonido cuando un cliente escribe.
 */
export function StaffSupportNotifier() {
  const pathname = usePathname();
  const onSupportPage =
    pathname === routes.support || pathname.startsWith(`${routes.support}/`);
  const [unread, setUnread] = useState<
    Array<{ id: string; name: string; preview: string }>
  >([]);
  const [expanded, setExpanded] = useState(false);
  const knownStampRef = useRef<Map<string, string>>(new Map());
  const seededRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/support/inbox?status=active", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        tickets?: InboxTicketLite[];
      };
      if (!res.ok || !data.ok) return;

      const tickets = (data.tickets ?? []).filter(
        (t) =>
          t.hasTicket !== false &&
          !t.id.startsWith("org:") &&
          !t.id.startsWith("hecom:") &&
          t.status !== "none",
      );

      const fresh: Array<{ id: string; name: string; preview: string }> = [];
      for (const ticket of tickets) {
        const stamp =
          ticket.lastMessageAt ?? ticket.updatedAt ?? ticket.createdAt ?? "";
        const prev = knownStampRef.current.get(ticket.id);
        knownStampRef.current.set(ticket.id, stamp);

        if (!seededRef.current) continue;
        if (!prev || prev === stamp) continue;
        if (ticket.lastMessageFromClient !== true) continue;

        fresh.push({
          id: ticket.id,
          name: ticket.requesterDisplayName?.trim() || "Cliente",
          preview:
            ticket.lastMessagePreview?.trim() || "Nuevo mensaje de cliente",
        });
      }

      if (!seededRef.current) {
        seededRef.current = true;
        return;
      }

      if (fresh.length === 0) return;

      playSupportNotifySound();
      setUnread((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const item of fresh) map.set(item.id, item);
        return Array.from(map.values());
      });
      setExpanded(true);
    } catch {
      // ignore poll errors
    }
  }, []);

  useEffect(() => {
    if (onSupportPage) return;
    void poll();
    const id = window.setInterval(() => void poll(), 4000);
    return () => window.clearInterval(id);
  }, [onSupportPage, poll]);

  if (onSupportPage || unread.length === 0) return null;

  const top = unread[0];

  return (
    <div className="pointer-events-none fixed bottom-4 left-3 z-50 flex max-w-[min(320px,calc(100vw-1.5rem))] flex-col items-start gap-2 sm:bottom-6 sm:left-5">
      <div className="pointer-events-auto flex flex-col items-start gap-2">
        {expanded ? (
          <div className="w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-2xl shadow-black/15 ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[rgb(255_120_31_/_0.08)] px-3 py-2">
              <p className="text-[12px] font-bold text-[var(--auth-text)]">
                {unread.length === 1
                  ? "Nuevo mensaje de cliente"
                  : `${unread.length} mensajes nuevos`}
              </p>
              <button
                type="button"
                className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--auth-text-muted)] hover:bg-black/5"
                onClick={() => setExpanded(false)}
              >
                Ocultar
              </button>
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {unread.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link
                    href={routes.support}
                    className="block px-3 py-2.5 hover:bg-[rgb(255_120_31_/_0.06)]"
                    onClick={() =>
                      setUnread((prev) => prev.filter((p) => p.id !== item.id))
                    }
                  >
                    <p className="truncate text-[13px] font-bold text-[var(--auth-text)]">
                      {item.name}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--auth-text-muted)]">
                      {item.preview}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={routes.support}
              className="block border-t border-[var(--border-subtle)] bg-[var(--brand-primary)] px-3 py-2.5 text-center text-[12px] font-bold text-white hover:bg-[var(--brand-primary-deep)]"
              onClick={() => setUnread([])}
            >
              Abrir inbox
            </Link>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "relative flex h-12 items-center gap-2 rounded-full bg-[var(--brand-primary)] pl-3 pr-4 text-white shadow-xl shadow-[rgb(255_120_31_/_0.4)] transition-transform hover:scale-[1.03] sm:h-14",
          )}
          aria-label={`${unread.length} mensajes nuevos de clientes`}
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12c0 4.556 4.03 8.25 9 8.25a9.764 9.764 0 002.555-.337 5.972 5.972 0 003.235 1.057 5.969 5.969 0 00.474-.065 4.48 4.48 0 01-.978-2.025c-.09-.457.133-.901.467-1.226C18.57 16.178 19.5 14.189 19.5 12c0-4.556-4.03-8.25-9-8.25s-9 3.694-9 8.25z"
              />
            </svg>
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-[var(--brand-primary)]">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          </span>
          <span className="max-w-[140px] truncate text-left text-[12px] font-bold leading-tight">
            {top.name}
            <span className="mt-0.5 block truncate font-medium opacity-90">
              {top.preview}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
