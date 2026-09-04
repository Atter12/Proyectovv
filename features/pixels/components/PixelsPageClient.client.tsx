"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TIKTOK_BROWSER_TEST_EVENTS } from "@/lib/integrations/tiktok/pixel-events.shared";

type AccountOpt = {
  id: string;
  name: string;
  advertiserId: string;
  status: string;
};

type PixelRow = {
  id: string;
  advertiserId: string;
  pixelId: string;
  pixelCode: string | null;
  name: string;
  status: string;
  eventsJson: unknown;
  createdAt: string;
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ttq?: any;
    TiktokAnalyticsObject?: string;
  }
}

function loadTikTokPixelSdk(pixelCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Solo en navegador"));
      return;
    }
    const w = window as Window & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ttq?: any;
      TiktokAnalyticsObject?: string;
    };
    w.TiktokAnalyticsObject = "ttq";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ttq: any = w.ttq || [];
    w.ttq = ttq;
    if (!ttq.loaded) {
      ttq.methods = [
        "page",
        "track",
        "identify",
        "instances",
        "debug",
        "on",
        "off",
        "once",
        "ready",
        "alias",
        "group",
        "enableCookie",
        "disableCookie",
      ];
      ttq.setAndDefer = function (t: typeof ttq, e: string) {
        t[e] = function (...args: unknown[]) {
          t.push([e, ...args]);
        };
      };
      for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
      ttq.instance = function (id: string) {
        const e = ttq._i?.[id] || [];
        for (const m of ttq.methods) ttq.setAndDefer(e, m);
        return e;
      };
      ttq.load = function (id: string) {
        const n = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[id] = [];
        ttq._i[id]._u = n;
        ttq._t = ttq._t || {};
        ttq._t[id] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[id] = {};
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.src = `${n}?sdkid=${id}&lib=ttq`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("No se pudo cargar SDK TikTok"));
        const first = document.getElementsByTagName("script")[0];
        first?.parentNode?.insertBefore(script, first);
      };
      ttq.loaded = true;
    }
    try {
      w.ttq.load(pixelCode);
      w.ttq.page?.();
      setTimeout(() => resolve(), 800);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

function snippetFor(pixelCode: string) {
  return `<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
  ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
  ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
  for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
  ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
  ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
  ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
  var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
  var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('${pixelCode}');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->`;
}

export function PixelsPageClient({
  clienteName,
}: {
  clienteName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [pixels, setPixels] = useState<PixelRow[]>([]);
  const [advertiserId, setAdvertiserId] = useState("");
  const [pixelName, setPixelName] = useState("");
  const [selectedPixelId, setSelectedPixelId] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [sdkReady, setSdkReady] = useState(false);

  const selectedPixel = useMemo(
    () => pixels.find((p) => p.id === selectedPixelId) ?? pixels[0] ?? null,
    [pixels, selectedPixelId],
  );

  const pixelCode =
    selectedPixel?.pixelCode?.trim() || selectedPixel?.pixelId || "";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pixels", { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        pixels?: PixelRow[];
        accounts?: AccountOpt[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo cargar píxeles.");
      }
      setPixels(json.pixels ?? []);
      setAccounts(json.accounts ?? []);
      if (!advertiserId && (json.accounts?.length ?? 0) > 0) {
        setAdvertiserId(json.accounts![0]!.advertiserId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de carga");
    } finally {
      setLoading(false);
    }
  }, [advertiserId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPixel && pixels[0]) setSelectedPixelId(pixels[0].id);
  }, [pixels, selectedPixel]);

  async function handleCreate() {
    if (!advertiserId) {
      setError("Elegí una cuenta ads.");
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pixels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiserId,
          pixelName:
            pixelName.trim() ||
            `${clienteName} · ${
              accounts.find((a) => a.advertiserId === advertiserId)?.name ??
              advertiserId
            }`,
          setupCodEvents: true,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        pixel?: PixelRow;
        events?: { applied: number; skipped: string[] } | null;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo crear el píxel.");
      }
      const skipped = json.events?.skipped?.length
        ? ` Eventos omitidos: ${json.events.skipped.join(", ")}.`
        : "";
      setNotice(
        `Píxel creado (${json.pixel?.pixelId}). Eventos COD: ${json.events?.applied ?? 0}.${skipped}`,
      );
      setPixelName("");
      await refresh();
      if (json.pixel?.id) setSelectedPixelId(json.pixel.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setCreating(false);
    }
  }

  async function handleSetupEvents() {
    if (!selectedPixel) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pixels/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelRowId: selectedPixel.id }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        applied?: number;
        skipped?: string[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudieron crear eventos.");
      }
      setNotice(
        `Eventos: ${json.applied ?? 0} OK` +
          (json.skipped?.length
            ? ` · omitidos ${json.skipped.join(", ")}`
            : ""),
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eventos");
    }
  }

  async function handleSync() {
    if (!advertiserId) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/pixels?syncAdvertiser=${encodeURIComponent(advertiserId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        remoteCount?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Sync falló.");
      }
      setNotice(`Sincronizados ${json.remoteCount ?? 0} píxeles desde TikTok.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error sync");
    }
  }

  async function ensureSdk() {
    if (!pixelCode) throw new Error("Sin pixel code/id");
    await loadTikTokPixelSdk(pixelCode);
    setSdkReady(true);
  }

  async function fireEvent(eventName: string) {
    setError(null);
    try {
      if (!sdkReady) await ensureSdk();
      window.ttq?.track(eventName, {
        content_type: "product",
        content_id: "holistic-test",
        value: 1,
        currency: "USD",
      });
      setTestLog((prev) => [
        `${new Date().toLocaleTimeString("es-PE")} · ${eventName}`,
        ...prev,
      ].slice(0, 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se disparó el evento");
    }
  }

  async function copySnippet() {
    if (!pixelCode) return;
    await navigator.clipboard.writeText(snippetFor(pixelCode));
    setNotice("Snippet copiado al portapapeles.");
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1rem] border border-[#ece7e0] bg-white shadow-[0_12px_32px_-20px_rgb(28_25_23_/_0.18)]">
        <div
          aria-hidden
          className="h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
        />
        <div className="p-5 sm:p-6">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
            Píxeles TikTok
          </p>
          <h1 className="mt-1 text-[1.35rem] font-bold tracking-[-0.03em] text-[#1c1917]">
            Crear y probar eventos · {clienteName}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] font-medium leading-5 text-[#5c564e]">
            Creá el píxel en la cuenta ads del cliente, registrá eventos COD y
            dispará pruebas con el SDK. Después instalá el snippet en la web /
            landing. Abrí{" "}
            <a
              href="https://ads.tiktok.com/i18n/events_manager"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#ff781f] underline underline-offset-2"
            >
              Events Manager → Test Events
            </a>{" "}
            para verificar.
          </p>
        </div>
      </section>

      {error ? (
        <div
          className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1rem] border border-[#ece7e0] bg-white p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
            Crear píxel
          </p>
          <label className="mt-3 block text-[12px] font-medium text-[#5c564e]">
            Cuenta ads (advertiser)
            <select
              className="mt-1 w-full rounded-lg border border-[#e7e0d8] bg-white px-3 py-2 text-[13px] text-[#1c1917]"
              value={advertiserId}
              onChange={(e) => setAdvertiserId(e.target.value)}
              disabled={loading || accounts.length === 0}
            >
              {accounts.length === 0 ? (
                <option value="">Sin cuentas en este cliente</option>
              ) : (
                accounts.map((a) => (
                  <option key={a.advertiserId} value={a.advertiserId}>
                    {a.name} · {a.advertiserId}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="mt-3 block text-[12px] font-medium text-[#5c564e]">
            Nombre (opcional)
            <input
              className="mt-1 w-full rounded-lg border border-[#e7e0d8] px-3 py-2 text-[13px]"
              value={pixelName}
              onChange={(e) => setPixelName(e.target.value)}
              placeholder={`${clienteName} · Pixel`}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating || !advertiserId}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#ff781f] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {creating ? "Creando…" : "Crear píxel + eventos COD"}
            </button>
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={!advertiserId || loading}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#e7e0d8] bg-white px-4 text-[13px] font-semibold text-[#1c1917]"
            >
              Sync desde TikTok
            </button>
          </div>
        </div>

        <div className="rounded-[1rem] border border-[#ece7e0] bg-white p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
            Píxeles del cliente
          </p>
          {loading ? (
            <p className="mt-3 text-[13px] text-[#8a8177]">Cargando…</p>
          ) : pixels.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#8a8177]">
              Todavía no hay píxeles guardados. Creá uno o sincronizá.
            </p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
              {pixels.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPixelId(p.id);
                      setSdkReady(false);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-[13px] ${
                      selectedPixel?.id === p.id
                        ? "border-[#ff781f] bg-[#fff1e8]"
                        : "border-[#ece7e0] bg-white"
                    }`}
                  >
                    <span className="font-semibold text-[#1c1917]">{p.name}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-[#6b645c]">
                      {p.pixelCode || p.pixelId} · adv {p.advertiserId}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {selectedPixel ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1rem] border border-[#ece7e0] bg-white p-5">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              Instalación
            </p>
            <p className="mt-2 font-mono text-[13px] text-[#1c1917]">
              Pixel: {pixelCode}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copySnippet()}
                className="inline-flex h-9 items-center rounded-lg border border-[#e7e0d8] px-3 text-[12px] font-semibold"
              >
                Copiar snippet
              </button>
              <button
                type="button"
                onClick={() => void handleSetupEvents()}
                className="inline-flex h-9 items-center rounded-lg border border-[#e7e0d8] px-3 text-[12px] font-semibold"
              >
                Reaplicar eventos COD
              </button>
            </div>
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-[#1c1917] p-3 text-[10px] leading-4 text-[#f5f0ea]">
              {snippetFor(pixelCode)}
            </pre>
          </div>

          <div className="rounded-[1rem] border border-[#ece7e0] bg-white p-5">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              Probar eventos (ttq)
            </p>
            <p className="mt-1 text-[12px] text-[#5c564e]">
              Dispará acá y mirá Test Events en TikTok. No reemplaza la
              instalación en tu sitio.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void ensureSdk().catch((e) => setError(String(e.message || e)))}
                className="inline-flex h-9 items-center rounded-lg bg-[#ff781f] px-3 text-[12px] font-semibold text-white"
              >
                {sdkReady ? "SDK listo" : "Cargar SDK"}
              </button>
              {TIKTOK_BROWSER_TEST_EVENTS.slice(0, 8).map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => void fireEvent(ev)}
                  className="inline-flex h-9 items-center rounded-lg border border-[#e7e0d8] px-3 text-[11px] font-semibold"
                >
                  {ev}
                </button>
              ))}
            </div>
            {testLog.length > 0 ? (
              <ul className="mt-3 space-y-1 text-[11px] text-[#6b645c]">
                {testLog.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
