"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/features/support/types/support.types";

const OPTIMISTIC_PREFIXES = ["user-", "agent-", "local-"];
const SYSTEM_IDS = new Set([
  "support-greeting",
  "inbox-empty",
  "no-thread",
  "empty",
]);

function isOptimisticId(id: string) {
  return OPTIMISTIC_PREFIXES.some((p) => id.startsWith(p));
}

function isSystemId(id: string) {
  return SYSTEM_IDS.has(id);
}

/** Une poll del server con optimistas locales (mientras viaja el POST). */
export function mergePolledMessages(
  prev: ChatMessage[],
  next: ChatMessage[],
): ChatMessage[] {
  if (next.length === 0) {
    const onlyPlaceholders = prev.every((m) => isSystemId(m.id));
    return onlyPlaceholders ? prev : next;
  }

  const nextIds = new Set(next.map((m) => m.id));
  const prevServerIds = prev
    .filter((m) => !isOptimisticId(m.id) && !isSystemId(m.id))
    .map((m) => m.id);

  // Poll stale: llegó tarde y aún no trae mensajes que ya confirmó el POST.
  // Sin esto el bubble “se manda → desaparece → vuelve”.
  const lostConfirmed = prevServerIds.some((id) => !nextIds.has(id));
  if (lostConfirmed && next.length < prevServerIds.length) {
    return prev;
  }

  const pendingOptimistic = prev.filter(
    (m) => isOptimisticId(m.id) && !nextIds.has(m.id),
  );

  // Si el server ya trae el mismo texto reciente, dropear optimista duplicado.
  const recentTexts = new Set(
    next.slice(-8).map((m) => `${m.role}|${m.text.trim()}`),
  );
  const stillPending = pendingOptimistic.filter(
    (m) => !recentTexts.has(`${m.role}|${m.text.trim()}`),
  );

  return [...next, ...stillPending];
}

/**
 * Polling liviano del hilo (sin VPS). Pausa con pestaña oculta.
 */
export function useSupportThreadPolling(options: {
  enabled: boolean;
  intervalMs?: number;
  fetchMessages: () => Promise<ChatMessage[] | null>;
  onMessages: (
    updater: (prev: ChatMessage[]) => ChatMessage[],
  ) => void;
}) {
  const { enabled, intervalMs = 2000, fetchMessages, onMessages } = options;
  const fetchRef = useRef(fetchMessages);
  const onRef = useRef(onMessages);
  fetchRef.current = fetchMessages;
  onRef.current = onMessages;
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || inFlight.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      inFlight.current = true;
      try {
        const next = await fetchRef.current();
        if (cancelled || !next) return;
        onRef.current((prev) => mergePolledMessages(prev, next));
      } catch {
        // Silencioso: el próximo tick reintenta.
      } finally {
        inFlight.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);

    function onVisible() {
      if (document.visibilityState === "visible") void tick();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs]);
}

/** Poll genérico (lista inbox) sin spinner. */
export function useSupportListPolling(options: {
  enabled: boolean;
  intervalMs?: number;
  refresh: () => Promise<void>;
}) {
  const { enabled, intervalMs = 3000, refresh } = options;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || inFlight.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      inFlight.current = true;
      try {
        await refreshRef.current();
      } catch {
        // ignore
      } finally {
        inFlight.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    function onVisible() {
      if (document.visibilityState === "visible") void tick();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs]);
}
