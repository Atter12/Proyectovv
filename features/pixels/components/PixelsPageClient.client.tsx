"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

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

/** Un píxel compartido se guarda una vez por cuenta vinculada: acá se ve uno solo. */
type PixelGroup = {
  key: string;
  rowId: string;
  name: string;
  pixelCode: string;
  advertiserIds: string[];
  events: string[];
};

/** Código base tal cual lo entrega TikTok en Events Manager. */
function snippetFor(pixelCode: string) {
  return `<!-- TikTok Pixel Code Start -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('${pixelCode}');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- TikTok Pixel Code End -->`;
}

function eventNamesFromJson(eventsJson: unknown): string[] {
  return Array.isArray(eventsJson)
    ? eventsJson.map((x) => String(x)).filter(Boolean)
    : [];
}

function groupPixels(rows: PixelRow[]): PixelGroup[] {
  const map = new Map<string, PixelGroup>();
  for (const p of rows) {
    const code = p.pixelCode?.trim() || p.pixelId;
    const key = p.pixelId || code;
    const events = eventNamesFromJson(p.eventsJson);
    const hit = map.get(key);
    if (!hit) {
      map.set(key, {
        key,
        rowId: p.id,
        name: p.name,
        pixelCode: code,
        advertiserIds: [p.advertiserId],
        events,
      });
      continue;
    }
    if (!hit.advertiserIds.includes(p.advertiserId)) {
      hit.advertiserIds.push(p.advertiserId);
    }
    // Si alguna fila ya tiene eventos, el píxel los tiene (son del píxel).
    if (events.length > hit.events.length) {
      hit.events = events;
      hit.rowId = p.id;
    }
  }
  return [...map.values()];
}

function CopyButton({
  value,
  label,
  copiedLabel,
  dark,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        })
      }
      className={
        dark
          ? "inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[#1c1917] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3a342e]"
          : "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[#e7e0d8] bg-white px-3 text-[12px] font-semibold text-[#1c1917] transition hover:border-[#cfc6bb]"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

export function PixelsPageClient({ clienteName }: { clienteName: string }) {
  const t = useTranslations("pixels");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [rows, setRows] = useState<PixelRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pixelName, setPixelName] = useState("");

  const pixels = useMemo(() => groupPixels(rows), [rows]);
  const selected =
    pixels.find((p) => p.key === selectedKey) ?? pixels[0] ?? null;
  const accountName = useCallback(
    (id: string) => accounts.find((a) => a.advertiserId === id)?.name ?? id,
    [accounts],
  );
  const creatorOpen = showCreate || (!loading && pixels.length === 0);

  type LoadResult =
    | { ok: true; pixels: PixelRow[]; accounts: AccountOpt[] }
    | { ok: false; error: string };

  const fetchPixels = useCallback(async (): Promise<LoadResult> => {
    try {
      const res = await fetch("/api/pixels", { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        pixels?: PixelRow[];
        accounts?: AccountOpt[];
      };
      if (!res.ok || !json.ok) return { ok: false, error: json.error || t("loadError") };
      return { ok: true, pixels: json.pixels ?? [], accounts: json.accounts ?? [] };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : t("loadError") };
    }
  }, [t]);

  const applyLoad = useCallback((r: LoadResult) => {
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setRows(r.pixels);
    setAccounts(r.accounts);
    setPickedIds((prev) => {
      const valid = prev.filter((id) => r.accounts.some((a) => a.advertiserId === id));
      return valid.length ? valid : r.accounts.map((a) => a.advertiserId);
    });
  }, []);

  // `loading` arranca en true; al recargar se siguen mostrando los datos actuales.
  const refresh = useCallback(
    async () => applyLoad(await fetchPixels()),
    [applyLoad, fetchPixels],
  );

  useEffect(() => {
    let alive = true;
    void fetchPixels().then((r) => {
      if (alive) applyLoad(r);
    });
    return () => {
      alive = false;
    };
  }, [fetchPixels, applyLoad]);

  function togglePicked(id: string) {
    setPickedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleCreate() {
    if (pickedIds.length === 0) {
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
          advertiserIds: pickedIds,
          pixelName: pixelName.trim() || undefined,
          setupCodEvents: false,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        pixel?: PixelRow;
        failures?: { advertiserId: string; error: string }[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || t("createError"));
      if (json.failures?.length) {
        setError(
          t("linkFailed", {
            accounts: json.failures.map((f) => accountName(f.advertiserId)).join(", "),
          }),
        );
      }
      setNotice(t("created"));
      setPixelName("");
      setShowCreate(false);
      await refresh();
      if (json.pixel?.pixelId) setSelectedKey(json.pixel.pixelId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("createError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleImport() {
    if (pickedIds.length === 0) {
      setError(t("pickAccounts"));
      return;
    }
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      let found = 0;
      for (const advertiserId of pickedIds) {
        const res = await fetch(
          `/api/pixels?syncAdvertiser=${encodeURIComponent(advertiserId)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          remoteCount?: number;
        };
        if (!res.ok || !json.ok) throw new Error(json.error || t("syncError"));
        found += json.remoteCount ?? 0;
      }
      await refresh();
      if (found === 0) {
        setNotice(t("importNone"));
      } else {
        setNotice(t("importFound", { count: found }));
        setShowCreate(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("syncError"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleActivate() {
    if (!selected) return;
    setActivating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/pixels/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelRowId: selected.rowId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        skipped?: string[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || t("eventsError"));
      setNotice(
        json.skipped?.length
          ? t("eventsDonePartial", { skipped: json.skipped.join(", ") })
          : t("eventsDone"),
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("eventsError"));
    } finally {
      setActivating(false);
    }
  }

  const emailHref = selected
    ? `mailto:?subject=${encodeURIComponent(t("emailSubject"))}&body=${encodeURIComponent(
        `${t("emailIntro")}\n\nPixel ID: ${selected.pixelCode}\n\n${snippetFor(selected.pixelCode)}`,
      )}`
    : "";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#ff781f]">
            {t("module")}
          </p>
          <h1 className="mt-1 text-[1.55rem] font-bold tracking-[-0.035em] text-[#1c1917] sm:text-[1.75rem]">
            {clienteName || t("title")}
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-[#5c564e]">
            {t("subtitle")}
          </p>
        </div>
        {pixels.length > 0 && !showCreate ? (
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setNotice(null);
            }}
            className="inline-flex h-10 items-center rounded-xl border border-[#e7e0d8] bg-white px-4 text-[13px] font-semibold text-[#1c1917] transition hover:border-[#cfc6bb]"
          >
            {t("newPixel")}
          </button>
        ) : null}
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

      {loading && pixels.length === 0 ? (
        <p className="rounded-2xl border border-[#ece7e0] bg-white px-5 py-8 text-center text-[13px] text-[#8a8177]">
          {tCommon("loading")}
        </p>
      ) : null}

      {creatorOpen && !loading ? (
        <section className="rounded-2xl border border-[#ece7e0] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[1.1rem] font-bold tracking-[-0.02em] text-[#1c1917]">
                {pixels.length === 0 ? t("createFirstTitle") : t("createTitle")}
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-[#5c564e]">
                {t("createBody")}
              </p>
            </div>
            {pixels.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-[12px] font-semibold text-[#8a8177] hover:text-[#1c1917]"
              >
                {tCommon("cancel")}
              </button>
            ) : null}
          </div>

          {accounts.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-4 py-5 text-[13px] text-[#8a8177]">
              {t("noAccounts")}
            </p>
          ) : (
            <>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
                {t("accountsLabel")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {accounts.map((a) => {
                  const on = pickedIds.includes(a.advertiserId);
                  return (
                    <button
                      key={a.advertiserId}
                      type="button"
                      onClick={() => togglePicked(a.advertiserId)}
                      aria-pressed={on}
                      className={`max-w-full truncate rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition ${
                        on
                          ? "border-[#ff781f] bg-[#fff4ec] text-[#1c1917]"
                          : "border-[#e7e0d8] bg-white text-[#8a8177] hover:border-[#cfc6bb]"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {a.name}
                    </button>
                  );
                })}
              </div>

              <label className="mt-5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
                {t("nameOptional")}
                <input
                  className="mt-1.5 w-full rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3.5 py-2.5 text-[13px] font-medium normal-case tracking-normal text-[#1c1917] outline-none transition focus:border-[#cfc6bb] focus:bg-white focus:ring-2 focus:ring-[#1c1917]/8"
                  value={pixelName}
                  onChange={(e) => setPixelName(e.target.value)}
                  placeholder={`${clienteName} · Pixel`}
                />
              </label>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating || syncing || pickedIds.length === 0}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ff781f] px-5 text-[13px] font-semibold text-white transition hover:bg-[#f06a12] disabled:opacity-50"
                >
                  {creating ? t("creating") : t("createAction")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={creating || syncing || pickedIds.length === 0}
                  className="text-[13px] font-semibold text-[#c2410c] underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {syncing ? t("importing") : t("importExisting")}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {pixels.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist">
          {pixels.map((p) => {
            const active = selected?.key === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedKey(p.key)}
                className={`flex max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition ${
                  active
                    ? "border-[#1c1917] bg-[#1c1917] text-white"
                    : "border-[#e7e0d8] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    p.events.length ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {selected ? (
        <section className="rounded-2xl border border-[#ece7e0] bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[1.25rem] font-bold tracking-[-0.025em] text-[#1c1917]">
                {selected.name}
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-[#5c564e]">
                {t("installBody")}
              </p>
            </div>
            <a
              href={emailHref}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#1c1917] px-4 text-[13px] font-semibold text-white transition hover:bg-[#3a342e]"
            >
              <span aria-hidden>✉</span>
              {t("emailInstructions")}
            </a>
          </div>

          <div className="mt-5 rounded-xl bg-[#f6f4f1] px-4 py-4 sm:px-5">
            <p className="text-[13.5px] font-bold text-[#1c1917]">
              {t("gettingStarted")}
            </p>
            <p className="mt-1 text-[12.5px] leading-5 text-[#5c564e]">
              {t("gettingStartedBody")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="min-w-0 break-all text-[14px] font-bold text-[#1c1917]">
                Pixel ID:{" "}
                <span className="font-mono tracking-wide">{selected.pixelCode}</span>
              </p>
              <CopyButton
                value={selected.pixelCode}
                label={t("copy")}
                copiedLabel={t("copied")}
              />
            </div>
            <p className="mt-2 text-[11.5px] text-[#8a8177]">
              {t("linkedTo", {
                accounts: selected.advertiserIds.map(accountName).join(" · "),
              })}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-[#ece7e0] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-[#1c1917]">
                  {t("step1Title")}
                </h3>
                <p className="mt-1 text-[12.5px] leading-5 text-[#5c564e]">
                  {t("step1Body")}
                </p>
              </div>
              <CopyButton
                value={snippetFor(selected.pixelCode)}
                label={t("copyCode")}
                copiedLabel={t("copied")}
                dark
              />
            </div>
            <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#f6f4f1] p-4 font-mono text-[11.5px] leading-5 text-[#5c564e]">
              {snippetFor(selected.pixelCode)}
            </pre>
          </div>

          <div className="mt-4 rounded-xl border border-[#ece7e0] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-[#1c1917]">
                  {t("step2Title")}
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      selected.events.length
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {selected.events.length ? t("eventsOn") : t("eventsOff")}
                  </span>
                </h3>
                <p className="mt-1 text-[12.5px] leading-5 text-[#5c564e]">
                  {t("step2Body")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleActivate()}
                disabled={activating}
                className={`inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition disabled:opacity-50 ${
                  selected.events.length
                    ? "border border-[#e7e0d8] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
                    : "bg-[#ff781f] text-white hover:bg-[#f06a12]"
                }`}
              >
                {activating
                  ? t("activating")
                  : selected.events.length
                    ? t("reactivate")
                    : t("activate")}
              </button>
            </div>
            {selected.events.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.events.map((ev) => (
                  <span
                    key={ev}
                    className="rounded-md bg-[#f3efe9] px-2 py-0.5 text-[11px] font-semibold text-[#5c564e]"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
