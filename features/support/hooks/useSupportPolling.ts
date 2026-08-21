"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/features/support/types/support.types";

const OPTIMISTIC_PREFIXES = ["user-", "agent-", "local-"];

function isOptimisticId(id: string) {
  return OPTIMISTIC_PREFIXES.some((p) => id.startsWith(p));
}

/** Une poll del server con optimistas locales (mientras viaja el POST). */
export function mergePolledMessages(
  prev: ChatMessage[],
  next: ChatMessage[],
): ChatMessage[] {
  if (next.length === 0) {
    const onlySystem = prev.every(
      (m) =>
        m.id === "support-greeting" ||
        m.id === "inbox-empty" ||
        m.id === "no-thread" ||
        m.id === "empty",
    );
    return onlySystem ? prev : next;
  }

  const serverIds = new Set(next.map((m) => m.id));
  const pendingOptimistic = prev.filter(
    (m) => isOptimisticId(m.id) && !serverIds.has(m.id),
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
  const { enabled, intervalMs = 2500, fetchMessages, onMessages } = options;
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
  const { enabled, intervalMs = 8000, refresh } = options;
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
