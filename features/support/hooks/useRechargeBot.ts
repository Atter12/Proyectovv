"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Bot de recarga dentro del chat de soporte (lado del navegador).
 *
 * Mantiene la interfaz que usa el chat: `handle(texto, archivos)` devuelve
 * true si el bot se hizo cargo del mensaje, false si debe seguir al ticket.
 * Toda la lógica y las validaciones viven en el servidor.
 */

type BotState = "idle" | "awaiting_amount" | "awaiting_payment";
type IntentView = { id: string; status: string };
type Pending = { paymentIntentId: string; grossPenCents: number; status: string } | null;

type MessageResponse = {
  handled?: boolean;
  state?: BotState;
  replies?: Array<{ id: string; text: string }>;
  intent?: IntentView | null;
  error?: string;
};

type StatusResponse = { pending?: Pending; intent?: IntentView | null };

const WATCH_INTERVAL_MS = 4000;
const WATCH_MAX_TICKS = 150; // unos 10 minutos

export function useRechargeBot(append: (texts: string[], userText?: string) => void) {
  const state = useRef<BotState>("idle");
  const appendRef = useRef(append);
  const stopWatch = useRef<(() => void) | null>(null);
  const notified = useRef(new Set<string>());
  const router = useRouter();

  useEffect(() => {
    appendRef.current = append;
  }, [append]);

  /** Espera a que la recarga se acredite y lo avisa en el chat. */
  const watch = useCallback(
    (intentId: string) => {
      stopWatch.current?.();
      let ticks = 0;
      let stopped = false;
      let timer: ReturnType<typeof setTimeout>;

      const check = async () => {
        if (stopped) return;
        ticks += 1;
        try {
          const res = await fetch(
            `/api/payments/recharge-chat?intentId=${encodeURIComponent(intentId)}`,
            { credentials: "include" },
          );
          const data = (await res.json()) as StatusResponse;
          const status = data.intent?.status;
          if (stopped) return;

          if (status === "succeeded") {
            if (!notified.current.has(intentId)) {
              notified.current.add(intentId);
              appendRef.current(["🎉 ¡Listo! Confirmé tu pago y el saldo ya está en tu cartera."]);
            }
            state.current = "idle";
            router.refresh();
            return;
          }
          if (status === "cancelled" || status === "failed") {
            appendRef.current([
              "Esa recarga se cerró sin acreditarse. Si ya pagaste, escríbeme y un gerente la revisa.",
            ]);
            state.current = "idle";
            return;
          }
        } catch {
          // Un fallo de red puntual no corta la espera ni se toma como pago.
        }

        if (ticks >= WATCH_MAX_TICKS) {
          appendRef.current([
            "Todavía no me llega la confirmación del banco. No vuelvas a pagar: escribe «ya pagué» en un rato y vuelvo a revisar.",
          ]);
          return;
        }
        timer = setTimeout(() => void check(), WATCH_INTERVAL_MS);
      };

      timer = setTimeout(() => void check(), WATCH_INTERVAL_MS);
      stopWatch.current = () => {
        stopped = true;
        clearTimeout(timer);
      };
    },
    [router],
  );

  // Al abrir el chat: retoma una recarga que ya estaba esperando al banco.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/payments/recharge-chat", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (cancelled || !data.pending) return;
        state.current = "awaiting_payment";
        if (data.pending.status === "processing") watch(data.pending.paymentIntentId);
      } catch {
        // Sin bot no pasa nada: el chat sigue funcionando con soporte.
      }
    })();
    return () => {
      cancelled = true;
      stopWatch.current?.();
    };
  }, [watch]);

  async function fetchPending(): Promise<Pending> {
    try {
      const res = await fetch("/api/payments/recharge-chat", { credentials: "include" });
      if (!res.ok) return null;
      return ((await res.json()) as StatusResponse).pending ?? null;
    } catch {
      return null;
    }
  }

  async function handle(text: string, files: File[]): Promise<boolean> {
    const proof = files.find(
      (file) => file.type.startsWith("image/") || file.type === "application/pdf",
    );

    // Una captura con una recarga en curso es su comprobante, no una consulta
    // para el gerente.
    if (proof) {
      const pending = await fetchPending();
      if (!pending) return false;

      const userText = text || "📎 Comprobante";
      const form = new FormData();
      form.set("intentId", pending.paymentIntentId);
      form.set("proof", proof);

      try {
        const res = await fetch("/api/payments/recharge-chat/proof", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const data = (await res.json()) as MessageResponse;
        if (!res.ok || data.error) {
          appendRef.current(
            [data.error ?? "No pude procesar tu comprobante. Inténtalo de nuevo."],
            userText,
          );
          return true;
        }
        appendRef.current((data.replies ?? []).map((r) => (typeof r === "string" ? r : r.text)), userText);
        if (data.intent?.status === "succeeded") {
          state.current = "idle";
          if (data.intent.id) notified.current.add(data.intent.id);
          router.refresh();
        } else if (data.intent?.status === "processing") {
          state.current = "awaiting_payment";
          watch(data.intent.id);
        }
      } catch {
        appendRef.current(
          ["No pude subir la captura. Revisa tu conexión e inténtalo de nuevo."],
          userText,
        );
      }
      return true;
    }

    if (!text || files.length) return false;

    try {
      const res = await fetch("/api/payments/recharge-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, state: state.current }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as MessageResponse;
      if (!data.handled) return false;

      state.current = data.state ?? "idle";
      appendRef.current((data.replies ?? []).map((r) => r.text), text);

      if (data.intent?.status === "succeeded") {
        router.refresh();
      } else if (data.intent?.status === "processing") {
        watch(data.intent.id);
      } else if (data.state === "idle") {
        stopWatch.current?.();
      }
      return true;
    } catch {
      // Si el bot no responde, el mensaje sigue al soporte de siempre.
      return false;
    }
  }

  return { handle };
}
