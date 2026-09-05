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

function eventNamesFromJson(eventsJson: unknown): string[] {
  if (Array.isArray(eventsJson)) {
    return eventsJson.map((x) => String(x)).filter(Boolean);
  }
  return [];
}

export function PixelsPageClient({
  clienteName,
}: {
  clienteName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [pixels, setPixels] = useState<PixelRow[]>([]);
  const [advertiserId, setAdvertiserId] = useState("");
  const [pixelName, setPixelName] = useState("");
  const [selectedPixelId, setSelectedPixelId] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.advertiserId === advertiserId) ?? null,
    [accounts, advertiserId],
  );

  const pixelsForAccount = useMemo(
    () =>
      advertiserId
        ? pixels.filter((p) => p.advertiserId === advertiserId)
        : pixels,
    [pixels, advertiserId],
  );

  const selectedPixel = useMemo(() => {
    if (selectedPixelId) {
      const hit = pixelsForAccount.find((p) => p.id === selectedPixelId);
      if (hit) return hit;
    }
    return pixelsForAccount[0] ?? null;
  }, [pixelsForAccount, selectedPixelId]);

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
      const nextAccounts = json.accounts ?? [];
      setAccounts(nextAccounts);
      setAdvertiserId((prev) => {
        if (prev && nextAccounts.some((a) => a.advertiserId === prev)) {
          return prev;
        }
        return nextAccounts[0]?.advertiserId ?? "";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de carga");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSdkReady(false);
    setTestLog([]);
    if (
      selectedPixelId &&
      !pixelsForAccount.some((p) => p.id === selectedPixelId)
    ) {
      setSelectedPixelId(pixelsForAccount[0]?.id ?? null);
    } else if (!selectedPixelId && pixelsForAccount[0]) {
      setSelectedPixelId(pixelsForAccount[0].id);
    }
  }, [advertiserId, pixelsForAccount, selectedPixelId]);

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
            `${clienteName} · ${selectedAccount?.name ?? advertiserId}`,
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
        ? ` Omitidos: ${json.events.skipped.join(", ")}.`
        : "";
      setNotice(
        `Píxel creado · ${json.pixel?.pixelId}. Eventos COD: ${json.events?.applied ?? 0}.${skipped}`,
      );
      setPixelName("");
      setLastSyncCount(null);
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
        `Eventos COD: ${json.applied ?? 0} OK` +
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
    setSyncing(true);
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
        pixels?: PixelRow[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo consultar TikTok.");
      }
      const n = json.remoteCount ?? 0;
      setLastSyncCount(n);
      await refresh();
      if (n === 0) {
        setNotice(
          "Esta cuenta ads no tiene píxeles en TikTok. Podés crear uno acá abajo.",
        );
      } else {
        setNotice(
          `TikTok tiene ${n} píxel${n === 1 ? "" : "es"} en esta cuenta. Ya los ves en la lista.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al consultar TikTok");
    } finally {
      setSyncing(false);
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
      setTestLog((prev) =>
        [
          `${new Date().toLocaleTimeString("es-PE")} · ${eventName}`,
          ...prev,
        ].slice(0, 20),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se disparó el evento");
    }
  }

  async function copySnippet() {
    if (!pixelCode) return;
    await navigator.clipboard.writeText(snippetFor(pixelCode));
    setNotice("Snippet copiado.");
  }

  const codEvents = eventNamesFromJson(selectedPixel?.eventsJson);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-[#ece7e0] bg-[linear-gradient(145deg,#fffaf6_0%,#ffffff_45%,#f7f4ef_100%)] px-5 py-6 sm:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff781f]/[0.12] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-10 h-40 w-40 rounded-full bg-[#ffa12c]/[0.1] blur-3xl"
        />
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#ff781f]">
          Píxeles TikTok
        </p>
        <h1 className="mt-1.5 text-[1.55rem] font-bold tracking-[-0.035em] text-[#1c1917] sm:text-[1.75rem]">
          {clienteName}
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#5c564e]">
          Dos caminos: crear un píxel nuevo con eventos COD, o preguntarle a
          TikTok si esta cuenta ya tiene alguno y verlo acá.
        </p>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#ece7e0] bg-white p-4 sm:p-5">
        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
          Cuenta ads
          <select
            className="mt-2 w-full rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3.5 py-2.5 text-[13px] font-medium text-[#1c1917] outline-none ring-[#ff781f]/30 focus:bg-white focus:ring-2"
            value={advertiserId}
            onChange={(e) => {
              setAdvertiserId(e.target.value);
              setLastSyncCount(null);
              setSdkReady(false);
            }}
            disabled={loading || accounts.length === 0}
          >
            {accounts.length === 0 ? (
              <option value="">Sin cuentas en uso</option>
            ) : (
              accounts.map((a) => (
                <option key={a.advertiserId} value={a.advertiserId}>
                  {a.name} · {a.advertiserId}
                </option>
              ))
            )}
          </select>
        </label>
        <p className="mt-2 text-[11px] text-[#8a8177]">
          Solo cuentas activas / en campaña
          {selectedAccount ? (
            <>
              {" "}
              · Advertiser{" "}
              <span className="font-mono text-[10px]">
                {selectedAccount.advertiserId}
              </span>
              {lastSyncCount !== null
                ? ` · última consulta TikTok: ${lastSyncCount} píxel${lastSyncCount === 1 ? "" : "es"}`
                : ""}
            </>
          ) : null}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-[#ece7e0] bg-white p-5 shadow-[0_10px_28px_-22px_rgb(28_25_23_/_0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
                Opción A
              </p>
              <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[#1c1917]">
                Crear píxel nuevo
              </h2>
            </div>
            <span className="rounded-full bg-[#fff1e8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#c2410c]">
              Recomendado
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-5 text-[#5c564e]">
            Crea el píxel en TikTok y deja listos los eventos COD (ViewContent,
            AddToCart, CompletePayment, etc.).
          </p>
          <label className="mt-4 block text-[12px] font-medium text-[#5c564e]">
            Nombre (opcional)
            <input
              className="mt-1.5 w-full rounded-xl border border-[#e7e0d8] px-3.5 py-2.5 text-[13px] outline-none ring-[#ff781f]/30 focus:ring-2"
              value={pixelName}
              onChange={(e) => setPixelName(e.target.value)}
              placeholder={`${clienteName} · Pixel`}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || !advertiserId}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12] disabled:opacity-50"
          >
            {creating ? "Creando…" : "Crear píxel + eventos COD"}
          </button>
        </article>

        <article className="flex flex-col rounded-2xl border border-dashed border-[#ddd5cb] bg-[#faf8f5] p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            Opción B
          </p>
          <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[#1c1917]">
            ¿Ya tiene en TikTok?
          </h2>
          <p className="mt-2 flex-1 text-[12.5px] leading-5 text-[#5c564e]">
            No crea nada. Solo pregunta a TikTok si esta cuenta ads ya tiene
            píxeles activos y los muestra en la lista de abajo.
          </p>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={!advertiserId || loading || syncing}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-[#d6cec4] bg-white px-4 text-[13px] font-semibold text-[#1c1917] transition hover:border-[#ff781f] hover:text-[#c2410c] disabled:opacity-50"
          >
            {syncing ? "Consultando TikTok…" : "Ver píxeles en TikTok"}
          </button>
          {lastSyncCount === 0 ? (
            <p className="mt-3 text-[12px] font-medium text-[#8a8177]">
              Resultado: no hay píxeles en esa cuenta.
            </p>
          ) : null}
          {lastSyncCount !== null && lastSyncCount > 0 ? (
            <p className="mt-3 text-[12px] font-medium text-emerald-800">
              Resultado: {lastSyncCount} encontrado
              {lastSyncCount === 1 ? "" : "s"} · ya visibles abajo.
            </p>
          ) : null}
        </article>
      </section>

      <section className="rounded-2xl border border-[#ece7e0] bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
              Píxeles acá
            </p>
            <h2 className="mt-1 text-[1.05rem] font-bold text-[#1c1917]">
              {advertiserId
                ? `De esta cuenta (${pixelsForAccount.length})`
                : `Todos (${pixels.length})`}
            </h2>
          </div>
          <a
            href="https://ads.tiktok.com/i18n/events_manager"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold text-[#ff781f] underline-offset-2 hover:underline"
          >
            Events Manager →
          </a>
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-[#8a8177]">Cargando…</p>
        ) : pixelsForAccount.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-4 py-8 text-center">
            <p className="text-[14px] font-semibold text-[#1c1917]">
              Todavía no hay píxeles en esta cuenta
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-5 text-[#5c564e]">
              Creá uno con la opción A, o tocá “Ver píxeles en TikTok” por si ya
              existen allá y aún no los trajimos.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {pixelsForAccount.map((p) => {
              const active = selectedPixel?.id === p.id;
              const code = p.pixelCode || p.pixelId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPixelId(p.id);
                      setSdkReady(false);
                      setTestLog([]);
                    }}
                    className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                      active
                        ? "border-[#ff781f] bg-[#fff7f0] shadow-[0_0_0_1px_#ff781f33]"
                        : "border-[#ece7e0] bg-white hover:border-[#d6cec4]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-[#1c1917]">
                        {p.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-[#f3efe9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6b645c]">
                        {p.status || "activo"}
                      </span>
                    </span>
                    <span className="mt-1 block truncate font-mono text-[11px] text-[#6b645c]">
                      {code}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedPixel ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#ece7e0] bg-white p-5">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
              Instalación
            </p>
            <p className="mt-2 font-mono text-[13px] font-semibold text-[#1c1917]">
              {pixelCode}
            </p>
            {codEvents.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {codEvents.map((ev) => (
                  <span
                    key={ev}
                    className="rounded-full bg-[#fff1e8] px-2 py-0.5 text-[10px] font-semibold text-[#c2410c]"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-[#8a8177]">
                Sin eventos COD guardados · podés reaplicarlos.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copySnippet()}
                className="inline-flex h-9 items-center rounded-lg bg-[#1c1917] px-3 text-[12px] font-semibold text-white"
              >
                Copiar snippet
              </button>
              <button
                type="button"
                onClick={() => void handleSetupEvents()}
                className="inline-flex h-9 items-center rounded-lg border border-[#e7e0d8] px-3 text-[12px] font-semibold text-[#1c1917]"
              >
                Reaplicar eventos COD
              </button>
            </div>
            <pre className="mt-3 max-h-44 overflow-auto rounded-xl bg-[#1c1917] p-3 text-[10px] leading-4 text-[#f5f0ea]">
              {snippetFor(pixelCode)}
            </pre>
          </div>

          <div className="rounded-2xl border border-[#ece7e0] bg-white p-5">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
              Probar acá
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[#5c564e]">
              Dispará eventos con el SDK y mirá{" "}
              <span className="font-semibold">Test Events</span> en TikTok. No
              reemplaza instalar el snippet en la web.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void ensureSdk().catch((e) =>
                    setError(String(e.message || e)),
                  )
                }
                className="inline-flex h-9 items-center rounded-lg bg-[#ff781f] px-3 text-[12px] font-semibold text-white"
              >
                {sdkReady ? "SDK listo ✓" : "Cargar SDK"}
              </button>
              {TIKTOK_BROWSER_TEST_EVENTS.slice(0, 8).map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => void fireEvent(ev)}
                  className="inline-flex h-9 items-center rounded-lg border border-[#e7e0d8] bg-[#faf8f5] px-3 text-[11px] font-semibold text-[#1c1917] hover:border-[#ff781f]"
                >
                  {ev}
                </button>
              ))}
            </div>
            {testLog.length > 0 ? (
              <ul className="mt-3 space-y-1 border-t border-[#f0ebe4] pt-3 font-mono text-[11px] text-[#6b645c]">
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
