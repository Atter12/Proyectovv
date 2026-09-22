"use client";

import { useEffect, useState } from "react";
import { clientEnv } from "@/lib/env/env.client";

const DISMISS_KEY = "holistic-home-hint-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function HomeScreenAppBanner() {
  const [mode, setMode] = useState<"hidden" | "install" | "push">("hidden");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const ios = isIos();
    const standalone = isStandalone();
    if (ios && !standalone) {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
      setMode("install");
      return;
    }
    if (!clientEnv.vapidPublicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;
    setMode("push");
  }, []);

  async function enablePush() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const key = urlBase64ToUint8Array(clientEnv.vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      });
      const json = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      setDone(true);
      setMode("hidden");
    } catch (error) {
      console.error("[push] no se pudo activar", error);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "hidden" || done) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg">
      <div className="pointer-events-auto rounded-2xl border border-[var(--auth-border)] bg-white p-3.5 shadow-[0_16px_40px_-20px_rgb(28_25_23_/_0.45)]">
        {mode === "install" ? (
          <>
            <p className="text-[13px] font-semibold text-[var(--auth-text)]">
              El botón de compartir es de Safari
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--auth-text-muted)]">
              Borra el ícono viejo. En Safari: Compartir → Agregar a inicio. Abrí Ads Holistic
              desde el ícono, no desde la pestaña. Ahí desaparece la barra y el login queda.
            </p>
            <button
              type="button"
              className="mt-2 text-[12px] font-semibold text-[var(--auth-text-soft)]"
              onClick={() => {
                window.localStorage.setItem(DISMISS_KEY, "1");
                setMode("hidden");
              }}
            >
              Entendido
            </button>
          </>
        ) : (
          <>
            <p className="text-[13px] font-semibold text-[var(--auth-text)]">
              Avisos de recargas
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--auth-text-muted)]">
              Te avisamos cuando se acredita una recarga. Si sos gerente, también cuando alguien
              manda un comprobante.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void enablePush()}
              className="mt-2 inline-flex h-9 items-center rounded-lg bg-[var(--auth-accent)] px-3 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Activando…" : "Activar avisos"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
