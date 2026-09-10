"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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

async function copyText(label: string, value: string) {
  await navigator.clipboard.writeText(value);
  return `${label} copiado.`;
}

export function PixelsPageClient({
  clienteName,
}: {
  clienteName: string;
}) {
  const t = useTranslations("pixels");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activatingEvents, setActivatingEvents] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [pixels, setPixels] = useState<PixelRow[]>([]);
  const [selectedAdvertiserIds, setSelectedAdvertiserIds] = useState<string[]>(
    [],
  );
  const [pixelName, setPixelName] = useState("");
  const [selectedPixelId, setSelectedPixelId] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);

  const selectedAccounts = useMemo(
    () =>
      accounts.filter((a) => selectedAdvertiserIds.includes(a.advertiserId)),
    [accounts, selectedAdvertiserIds],
  );

  const allSelected =
    accounts.length > 0 && selectedAdvertiserIds.length === accounts.length;

  const pixelsForAccount = useMemo(() => {
    if (selectedAdvertiserIds.length === 0) return pixels;
    const set = new Set(selectedAdvertiserIds);
    return pixels.filter((p) => set.has(p.advertiserId));
  }, [pixels, selectedAdvertiserIds]);

  const selectedPixel = useMemo(() => {
    if (selectedPixelId) {
      const hit = pixelsForAccount.find((p) => p.id === selectedPixelId);
      if (hit) return hit;
    }
    return pixelsForAccount[0] ?? null;
  }, [pixelsForAccount, selectedPixelId]);

  const pixelCode =
    selectedPixel?.pixelCode?.trim() || selectedPixel?.pixelId || "";
  const pixelIdDisplay = selectedPixel?.pixelId?.trim() || "";
  const codEvents = eventNamesFromJson(selectedPixel?.eventsJson);
  const hasCodEvents = codEvents.length > 0;
  const hasPixels = pixelsForAccount.length > 0;

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
      setSelectedAdvertiserIds((prev) => {
        const valid = prev.filter((id) =>
          nextAccounts.some((a) => a.advertiserId === id),
        );
        if (valid.length > 0) return valid;
        return nextAccounts[0] ? [nextAccounts[0].advertiserId] : [];
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
  }, [selectedAdvertiserIds, pixelsForAccount, selectedPixelId]);

  function toggleAdvertiser(id: string) {
    setLastSyncCount(null);
    setSdkReady(false);
    setSelectedAdvertiserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllAdvertisers() {
    setLastSyncCount(null);
    setSdkReady(false);
    setSelectedAdvertiserIds(accounts.map((a) => a.advertiserId));
  }

  function clearAdvertisers() {
    setLastSyncCount(null);
    setSdkReady(false);
    setSelectedAdvertiserIds([]);
  }

  async function handleCreatePixelOnly() {
    if (selectedAdvertiserIds.length === 0) {
      setError(t("pickAccounts"));
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
          advertiserIds: selectedAdvertiserIds,
          pixelName: pixelName.trim() || undefined,
          setupCodEvents: false,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        mode?: "single" | "shared";
        pixel?: PixelRow;
        pixels?: PixelRow[];
        createdCount?: number;
        requestedCount?: number;
        linkedAdvertiserIds?: string[];
        failures?: { advertiserId: string; error: string }[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo crear el píxel.");
      }
      const linked = json.linkedAdvertiserIds?.length ?? selectedAdvertiserIds.length;
      const failN = json.failures?.length ?? 0;
      const id = json.pixel?.pixelId ?? "";
      const code = json.pixel?.pixelCode ?? "";
      if (json.mode === "shared" || selectedAdvertiserIds.length > 1) {
        setNotice(
          failN > 0
            ? `Píxel creado (ID ${id}). Vinculado a ${linked} cuenta(s); ${failN} no se pudieron vincular. Code: ${code || "—"}.`
            : `Píxel único creado y vinculado a ${linked} cuentas. ID: ${id}${code ? ` · Code: ${code}` : ""}. Ahora instálalo en la tienda (paso 3).`,
        );
      } else {
        setNotice(
          `Píxel creado. ID: ${id}. Ahora instálalo / conectalo a tu tienda (paso 3). Los eventos COD se activan después (paso 4).`,
        );
      }
      if (failN > 0 && json.failures?.[0]?.error) {
        setError(
          json.failures.map((f) => `${f.advertiserId}: ${f.error}`).join(" · "),
        );
      }
      setPixelName("");
      setLastSyncCount(null);
      await refresh();
      if (json.pixel?.id) setSelectedPixelId(json.pixel.id);
      else if (json.pixels?.[0]?.id) setSelectedPixelId(json.pixels[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setCreating(false);
    }
  }

  async function handleActivateEvents() {
    if (!selectedPixel) {
      setError(t("pickPixel"));
      return;
    }
    setActivatingEvents(true);
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
        throw new Error(json.error || "No se pudieron activar eventos.");
      }
      setNotice(
        `Eventos COD activados: ${json.applied ?? 0}` +
          (json.skipped?.length
            ? ` · omitidos ${json.skipped.join(", ")}`
            : "") +
          ". Ya deberían verse en Events Manager.",
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eventos");
    } finally {
      setActivatingEvents(false);
    }
  }

  async function handleSync() {
    if (selectedAdvertiserIds.length === 0) return;
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      let totalRemote = 0;
      for (const advertiserId of selectedAdvertiserIds) {
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
          throw new Error(json.error || "No se pudo consultar TikTok.");
        }
        totalRemote += json.remoteCount ?? 0;
      }
      setLastSyncCount(totalRemote);
      await refresh();
      const nAcc = selectedAdvertiserIds.length;
      if (totalRemote === 0) {
        setNotice(
          nAcc > 1
            ? "Las cuentas seleccionadas no tienen píxeles en TikTok. Crea con el botón 1."
            : "Esta cuenta ads no tiene píxeles en TikTok. Crea uno con el botón 1.",
        );
      } else {
        setNotice(
          `TikTok tiene ${totalRemote} píxel${totalRemote === 1 ? "" : "es"} en ${nAcc} cuenta${nAcc === 1 ? "" : "s"}. Seleccionalo abajo y activa eventos cuando ya esté en la tienda.`,
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

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-2xl border border-[#ece7e0] bg-white px-5 py-6 sm:px-7">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#ff781f]">
          {t("module")}
        </p>
        <h1 className="mt-1.5 text-[1.55rem] font-bold tracking-[-0.035em] text-[#1c1917] sm:text-[1.75rem]">
          {clienteName || t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#5c564e]">
          {t("subtitleBefore")}{" "}
          <span className="font-semibold text-[#1c1917]">
            {t("subtitleCreate")}
          </span>{" "}
          {t("subtitleMid")}{" "}
          <span className="font-semibold text-[#1c1917]">
            {t("subtitleEvents")}
          </span>{" "}
          {t("subtitleAfter")}
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { n: "1", label: t("stepAccount") },
            { n: "2", label: t("stepCreate") },
            { n: "3", label: t("stepConnect") },
            { n: "4", label: t("stepEvents") },
            { n: "5", label: t("stepTest") },
          ].map((step) => (
            <li
              key={step.n}
              className="flex items-center gap-2.5 rounded-xl border border-[#f0ebe4] bg-[#faf8f5] px-3 py-2.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[11px] font-bold text-white">
                {step.n}
              </span>
              <span className="text-[12px] font-semibold text-[#1c1917]">
                {step.label}
              </span>
            </li>
          ))}
        </ol>
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
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              Paso 1
            </p>
            <h2 className="mt-0.5 text-[15px] font-bold text-[#1c1917]">
              {t("step1Title")}
            </h2>
            <p className="mt-1 text-[12px] text-[#5c564e]">
              Selecciona una, varias o todas. Se crea <strong>un solo píxel</strong>{" "}
              y se vincula a las cuentas marcadas.
            </p>
          </div>
          {accounts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllAdvertisers}
                disabled={loading || allSelected}
                className="rounded-lg border border-[#e7e0d8] bg-[#faf8f5] px-2.5 py-1.5 text-[11px] font-semibold text-[#1c1917] disabled:opacity-40"
              >
                {t("selectAll")}
              </button>
              <button
                type="button"
                onClick={clearAdvertisers}
                disabled={loading || selectedAdvertiserIds.length === 0}
                className="rounded-lg border border-[#e7e0d8] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#5c564e] disabled:opacity-40"
              >
                {t("clear")}
              </button>
            </div>
          ) : null}
        </div>

        {accounts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-3 py-4 text-[13px] text-[#8a8177]">
            {t("noAccounts")}
          </p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-[#ece7e0] bg-[#faf8f5] p-2">
            {accounts.map((a) => {
              const checked = selectedAdvertiserIds.includes(a.advertiserId);
              return (
                <li key={a.advertiserId}>
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition ${
                      checked ? "bg-white shadow-sm ring-1 ring-[#ff781f]/35" : "hover:bg-white/70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[#ff781f]"
                      checked={checked}
                      onChange={() => toggleAdvertiser(a.advertiserId)}
                      disabled={loading}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-[#1c1917]">
                        {a.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-[#8a8177]">
                        {a.advertiserId}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-2 text-[12px] font-medium text-[#5c564e]">
          {selectedAdvertiserIds.length === 0
            ? "Ninguna cuenta seleccionada"
            : `${selectedAdvertiserIds.length} de ${accounts.length} seleccionada${selectedAdvertiserIds.length === 1 ? "" : "s"}`}
        </p>

        {selectedAccounts.length === 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#faf8f5] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
                Advertiser ID
              </p>
              <p className="truncate font-mono text-[12px] font-semibold text-[#1c1917]">
                {selectedAccounts[0]!.advertiserId}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-[#e7e0d8] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1c1917]"
              onClick={() =>
                void copyText(
                  "Advertiser ID",
                  selectedAccounts[0]!.advertiserId,
                ).then(setNotice)
              }
            >
              Copiar ID
            </button>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-[#ece7e0] bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#c2410c]">
            {t("btn1")}
          </p>
          <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[#1c1917]">
            {t("createPixel")}
          </h2>
          <p className="mt-2 text-[12.5px] leading-5 text-[#5c564e]">
            Crea <strong>un píxel</strong> en TikTok. Si marcaste varias cuentas,
            se <strong>vincula el mismo</strong> a todas (Pixel ID único para la
            tienda). <strong>No activa eventos todavía</strong>.
          </p>
          <label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
            Nombre (opcional)
            <input
              className="mt-1.5 w-full rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3.5 py-2.5 text-[13px] font-medium normal-case tracking-normal text-[#1c1917] outline-none transition focus:border-[#cfc6bb] focus:bg-white focus:ring-2 focus:ring-[#1c1917]/8"
              value={pixelName}
              onChange={(e) => setPixelName(e.target.value)}
              placeholder={`${clienteName} · Pixel`}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCreatePixelOnly()}
            disabled={creating || selectedAdvertiserIds.length === 0}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12] disabled:opacity-50"
          >
            {creating
              ? "Creando y vinculando…"
              : selectedAdvertiserIds.length > 1
                ? `1 · Crear 1 píxel y vincular a ${selectedAdvertiserIds.length} cuentas`
                : t("createAction")}
          </button>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={
              selectedAdvertiserIds.length === 0 || loading || syncing
            }
            className="mt-2 inline-flex h-10 items-center justify-center rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-4 text-[12px] font-semibold text-[#1c1917] transition hover:bg-white disabled:opacity-50"
          >
            {syncing ? t("querying") : t("importExisting")}
          </button>
          {lastSyncCount === 0 ? (
            <p className="mt-2 text-[12px] text-[#8a8177]">
              No hay píxeles en esa cuenta en TikTok.
            </p>
          ) : null}
        </article>

        <article className="flex flex-col rounded-2xl border border-[#ece7e0] bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0f766e]">
            {t("btn2")}
          </p>
          <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[#1c1917]">
            Activar eventos
          </h2>
          <p className="mt-2 flex-1 text-[12.5px] leading-5 text-[#5c564e]">
            Usalo <strong>después</strong> de conectar el píxel a la tienda
            (paso 3). Registra en TikTok los eventos COD (ViewContent, AddToCart,
            CompletePayment, etc.) para que queden visibles en Events Manager.
          </p>
          {!selectedPixel ? (
            <p className="mt-4 text-[12px] font-medium text-[#8a8177]">
              Primero crea o selecciona un píxel.
            </p>
          ) : hasCodEvents ? (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-900">
              Este píxel ya tiene {codEvents.length} eventos COD activos.
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-950">
              Píxel listo · eventos COD todavía no activados.
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleActivateEvents()}
            disabled={!selectedPixel || activatingEvents}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#1c1917] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3a342e] disabled:opacity-50"
          >
            {activatingEvents
              ? "Activando eventos…"
              : hasCodEvents
                ? "2 · Reaplicar eventos COD"
                : "2 · Activar eventos"}
          </button>
        </article>
      </section>

      <section className="rounded-2xl border border-[#ece7e0] bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              {t("yourPixels")}
            </p>
            <h2 className="mt-0.5 text-[1.05rem] font-bold text-[#1c1917]">
              {selectedAdvertiserIds.length > 0
                ? `${pixelsForAccount.length} en ${selectedAdvertiserIds.length === 1 ? "esta cuenta" : `${selectedAdvertiserIds.length} cuentas`}`
                : `${pixels.length} en total`}
            </h2>
          </div>
          <a
            href="https://ads.tiktok.com/i18n/events_manager"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold text-[#c2410c] underline-offset-2 hover:underline"
          >
            Abrir Events Manager →
          </a>
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-[#8a8177]">Cargando…</p>
        ) : !hasPixels ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-4 py-8 text-center">
            <p className="text-[14px] font-semibold text-[#1c1917]">
              {t("noPixels")}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-5 text-[#5c564e]">
              Usa el botón 1 para crear uno, o “traer de TikTok” si ya existía.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {pixelsForAccount.map((p) => {
              const active = selectedPixel?.id === p.id;
              const code = p.pixelCode || p.pixelId;
              const eventsOn = eventNamesFromJson(p.eventsJson).length > 0;
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
                        ? "border-[#1c1917] bg-[#faf8f5]"
                        : "border-[#ece7e0] bg-white hover:border-[#d6cec4]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-[#1c1917]">
                        {p.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          eventsOn
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-amber-100 text-amber-950"
                        }`}
                      >
                        {eventsOn ? "Eventos ON" : "Sin eventos"}
                      </span>
                    </span>
                    <span className="mt-1 block truncate font-mono text-[11px] text-[#6b645c]">
                      ID {p.pixelId}
                    </span>
                    {p.pixelCode && p.pixelCode !== p.pixelId ? (
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-[#8a8177]">
                        Code {code}
                      </span>
                    ) : null}
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
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              Paso 3 · Conectar a tu tienda
            </p>
            <h2 className="mt-1 text-[1.05rem] font-bold text-[#1c1917]">
              IDs + snippet
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[#5c564e]">
              Copia el <strong>Pixel code</strong> (tipo{" "}
              <span className="font-mono text-[11px]">DAE…</span>, lo que
              Shopify suele pedir como “Pixel ID”) o el snippet, e instálalo en
              la tienda / landing. El ID numérico es el de TikTok API. Hasta que
              esté en la web, TikTok no recibe ventas reales.
            </p>

            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
                    Pixel ID (TikTok)
                  </p>
                  <p className="truncate font-mono text-[12px] font-semibold text-[#1c1917]">
                    {pixelIdDisplay}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-[#e7e0d8] bg-white px-2.5 py-1.5 text-[11px] font-semibold"
                  onClick={() =>
                    void copyText("Pixel ID", pixelIdDisplay).then(setNotice)
                  }
                >
                  {t("copyCode")}
                </button>
              </div>
              {selectedPixel.pixelCode &&
              selectedPixel.pixelCode !== selectedPixel.pixelId ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
                      Pixel code (snippet)
                    </p>
                    <p className="truncate font-mono text-[12px] font-semibold text-[#1c1917]">
                      {selectedPixel.pixelCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-[#e7e0d8] bg-white px-2.5 py-1.5 text-[11px] font-semibold"
                    onClick={() =>
                      void copyText(
                        "Pixel code",
                        selectedPixel.pixelCode!,
                      ).then(setNotice)
                    }
                  >
                    {t("copyCode")}
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
                    Advertiser ID
                  </p>
                  <p className="truncate font-mono text-[12px] font-semibold text-[#1c1917]">
                    {selectedPixel.advertiserId}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-[#e7e0d8] bg-white px-2.5 py-1.5 text-[11px] font-semibold"
                  onClick={() =>
                    void copyText(
                      "Advertiser ID",
                      selectedPixel.advertiserId,
                    ).then(setNotice)
                  }
                >
                  {t("copyCode")}
                </button>
              </div>
            </div>

            {hasCodEvents ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {codEvents.map((ev) => (
                  <span
                    key={ev}
                    className="rounded-md bg-[#f3efe9] px-2 py-0.5 text-[10px] font-semibold text-[#5c564e]"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-amber-800">
                {t("eventsPending")}
              </p>
            )}

            <button
              type="button"
              onClick={() =>
                void copyText("Snippet", snippetFor(pixelCode)).then(setNotice)
              }
              className="mt-3 inline-flex h-9 items-center rounded-lg bg-[#1c1917] px-3 text-[12px] font-semibold text-white transition hover:bg-[#3a342e]"
            >
              Copiar snippet completo
            </button>
            <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-[#2a2520] bg-[#1c1917] p-3 text-[10px] leading-4 text-[#f5f0ea]">
              {snippetFor(pixelCode)}
            </pre>
          </div>

          <div className="rounded-2xl border border-[#ece7e0] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              {t("step5")}
            </p>
            <h2 className="mt-1 text-[1.05rem] font-bold text-[#1c1917]">
              {t("testEvents")}
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[#5c564e]">
              Dispara acá y mira{" "}
              <span className="font-semibold text-[#1c1917]">Test Events</span>{" "}
              en TikTok. No reemplaza instalar el snippet en la tienda.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void ensureSdk().catch((e) =>
                    setError(String(e.message || e)),
                  )
                }
                className="inline-flex h-9 items-center rounded-lg bg-[#ff781f] px-3 text-[12px] font-semibold text-white transition hover:bg-[#f06a12]"
              >
                {sdkReady ? t("sdkReady") : t("loadSdk")}
              </button>
              {TIKTOK_BROWSER_TEST_EVENTS.slice(0, 8).map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => void fireEvent(ev)}
                  className="inline-flex h-9 items-center rounded-lg border border-[#e7e0d8] bg-[#faf8f5] px-3 text-[11px] font-semibold text-[#1c1917] transition hover:border-[#cfc6bb] hover:bg-white"
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
