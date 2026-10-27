"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";

/** Business de Real Profit con el que el cliente comparte su cuenta de Meta (modo socio). */
const META_PARTNER_BUSINESS_ID = "1400772061135321";
const COURIER_TEMPLATE =
  "pedido;estado;monto_cobrado;costo_envio;courier\n#1001;entregado;89.90;12;Olva\n#1002;rechazado;;15;Shalom\n#1003;en ruta;;;Urbaner\n";

export type RpConnections = {
  shopify: { connected: boolean; storeId: string | null; storeName: string | null; shopDomain: string | null };
  tiktok: { connected: boolean; accounts: number };
  meta: {
    connected: boolean;
    accountName: string | null;
    lastSyncAt: string | null;
    lastSyncError: string | null;
  };
  courier: { ordersFromCourier: number; lastImportAt: string | null };
};

type CourierPreview = {
  matched?: number;
  totalRows?: number;
  notFound?: number;
  invalid?: number;
  byStatus?: Record<string, number>;
  message?: string;
  error?: string;
};

function normalizeShopDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function withShop(installUrl: string | null, shop: string): string | null {
  if (!installUrl) return null;
  const domain = normalizeShopDomain(shop);
  if (!domain) return installUrl;
  const url = new URL(installUrl);
  url.searchParams.set("shop", domain.includes(".") ? domain : `${domain}.myshopify.com`);
  return url.toString();
}

const inputClass =
  "h-10 w-full min-w-0 rounded-xl sm:flex-1 border border-[#e7e0d8] bg-[#faf8f5] px-3 text-[13px] font-medium text-[#1c1917] outline-none transition placeholder:text-[#b0a89e] focus:border-[#ff781f]/50 focus:bg-white focus:ring-2 focus:ring-[#ff781f]/15";
const primaryBtn =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] disabled:opacity-50";
const ghostBtn =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[#e7e0d8] bg-white px-4 text-[13px] font-semibold text-[#3f3a34] transition hover:bg-[#faf8f5] disabled:opacity-50";

function StatusPill({ tone, children }: { tone: "ok" | "auto" | "todo" | "locked"; children: ReactNode }) {
  const cls = {
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    auto: "bg-sky-50 text-sky-700 ring-sky-200",
    todo: "bg-[#fff4ec] text-[#c2410c] ring-[#ffd7b8]",
    locked: "bg-[#f5f2ee] text-[#8a8177] ring-[#e7e0d8]",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      {tone === "ok" || tone === "auto" ? <span aria-hidden>✓</span> : null}
      {children}
    </span>
  );
}

function SourceCard({
  step,
  logo,
  title,
  status,
  children,
}: {
  step: number;
  logo: ReactNode;
  title: string;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#ece7e0] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#faf8f5] ring-1 ring-[#ece7e0]">
          {logo}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b0a89e]">
            {step}
          </p>
          <h3 className="truncate text-[15px] font-bold tracking-[-0.01em] text-[#1c1917]">
            {title}
          </h3>
        </div>
        {status}
      </div>
      <div className="mt-3 flex flex-1 flex-col text-[12.5px] leading-5 text-[#5c564e]">
        {children}
      </div>
    </div>
  );
}

const logos = {
  shopify: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#95BF47" d="M15.3 3.4c-.1 0-.2 0-.3.1l-.6.2C14 2.6 13.4 2 12.4 2h-.1c-.3-.4-.7-.5-1-.5-2.4 0-3.6 3-4 4.6l-1.7.5c-.5.2-.5.2-.6.7L3.7 19.4 14.5 21.4l5.8-1.3S15.4 3.5 15.3 3.4zM12.6 4.1l-.9.3V4.2c0-.6-.1-1-.2-1.4.5.1.9.6 1.1 1.3zm-1.8-1.2c.2.4.3.9.3 1.6v.1l-1.9.6c.4-1.4 1-2.1 1.6-2.3zm-.7-.7c.1 0 .2 0 .3.1-.8.4-1.7 1.4-2.1 3.3l-1.5.5c.4-1.4 1.4-3.9 3.3-3.9z" />
      <path fill="#5E8E3E" d="M15 3.5l-.6.2-.6 17.7 6.5-1.3S15.4 3.5 15.3 3.4c-.1 0-.2 0-.3.1z" />
      <path fill="#fff" d="M11.3 7.7l-.7 2.1s-.6-.3-1.4-.3c-1.1 0-1.2.7-1.2.9 0 1 2.6 1.4 2.6 3.7 0 1.8-1.2 3-2.7 3-1.8 0-2.8-1.1-2.8-1.1l.5-1.6s1 .8 1.8.8c.5 0 .8-.4.8-.7 0-1.3-2.1-1.4-2.1-3.5 0-1.8 1.3-3.5 3.9-3.5 1 0 1.3.2 1.3.2z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#25F4EE" d="M9.4 9.4v-.9a6.9 6.9 0 0 0-.9-.1 6.6 6.6 0 0 0-3.8 12 6.6 6.6 0 0 1 4.7-11z" />
      <path fill="#FE2C55" d="M9.6 19.5a3 3 0 0 0 3-2.9V2.5h2.6a5 5 0 0 1-.1-.9h-3.5v14.1a3 3 0 0 1-3 2.9 3 3 0 0 1-1.4-.3 3 3 0 0 0 2.4 1.2zM19.9 7.3v-.9a4.9 4.9 0 0 1-2.7-.8 5 5 0 0 0 2.7 1.7z" />
      <path fill="#000" d="M17.2 5.6a5 5 0 0 1-1.2-3.1h-.9a5 5 0 0 0 2.1 3.1zM8.5 12.5a3 3 0 0 0-1.4 5.7 3 3 0 0 1 2.3-4.8 3 3 0 0 1 .9.1V9.9a6.5 6.5 0 0 0-.9-.1h-.2v2.8a3 3 0 0 0-.7-.1zM19.9 7.3v2.7a8.5 8.5 0 0 1-5-1.6v7.2a6.6 6.6 0 0 1-10.2 5.5A6.6 6.6 0 0 0 16 16.4V9.2a8.5 8.5 0 0 0 5 1.6V7.4a5 5 0 0 1-1.1-.1z" />
    </svg>
  ),
  meta: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#0866FF" d="M6.9 5C4.2 5 2 8.9 2 13c0 2.5 1.1 4.2 3.1 4.2 1.6 0 2.7-.8 4.6-4l1.1-1.9.4.7 1.3 2.2c1.8 2.9 2.9 3.6 4.5 3.6 2 0 3-1.7 3-4.1C20 9 17.9 5 15.2 5c-1.5 0-2.7 1-4 2.8C9.9 6 8.6 5 6.9 5zm8.2 2.3c1.6 0 2.9 2.4 2.9 5.6 0 1.2-.4 1.9-1.1 1.9-.7 0-1.1-.4-2.4-2.5l-1.4-2.4-.6-1c.9-1.1 1.6-1.6 2.6-1.6zm-8.3.2c1 0 1.7.5 2.9 2.4l-.9 1.5c-1.5 2.3-2 2.9-2.8 2.9-.8 0-1.2-.7-1.2-1.9 0-2.5 1-4.9 2-4.9z" />
    </svg>
  ),
  courier: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#ff781f]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  ),
};

export function RealProfitConnect({
  connections,
  installUrl,
  realProfitUrl,
  onChanged,
  tiktokLinked,
  onTikTokLinkedChange,
}: {
  connections: RpConnections | null;
  installUrl: string | null;
  realProfitUrl: string;
  onChanged: () => Promise<void> | void;
  /** El cliente tocó «Conectar TikTok Ads»: se muestran sus métricas. */
  tiktokLinked: boolean;
  onTikTokLinkedChange: (on: boolean) => void;
}) {
  const t = useTranslations("profit.rp");
  const c = connections;
  const shopifyOn = Boolean(c?.shopify.connected);
  const connectedCount = [
    shopifyOn,
    c?.tiktok.connected && tiktokLinked,
    c?.meta.connected,
    (c?.courier.ordersFromCourier ?? 0) > 0,
  ].filter(Boolean).length;

  // Shopify
  const [shop, setShop] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const installHref = withShop(installUrl, shop);

  async function retryLink() {
    setLinkBusy(true);
    setLinkMsg(null);
    try {
      const res = await fetch("/api/profit/link-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: shop.trim() || undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setLinkMsg(res.ok ? { ok: true, text: json.message ?? t("linked") } : { ok: false, text: json.error ?? t("genericError") });
      if (res.ok) await onChanged();
    } catch {
      setLinkMsg({ ok: false, text: t("genericError") });
    } finally {
      setLinkBusy(false);
    }
  }

  // Meta
  const [adAccount, setAdAccount] = useState("");
  const [metaBusy, setMetaBusy] = useState(false);
  const [metaMsg, setMetaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [metaEditing, setMetaEditing] = useState(false);

  async function connectMeta() {
    setMetaBusy(true);
    setMetaMsg(null);
    try {
      const res = await fetch("/api/profit/meta-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: adAccount, storeId: c?.shopify.storeId }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      setMetaMsg(res.ok ? { ok: true, text: json.message ?? t("metaConnected") } : { ok: false, text: json.error ?? t("genericError") });
      if (res.ok) {
        setMetaEditing(false);
        await onChanged();
      }
    } catch {
      setMetaMsg({ ok: false, text: t("genericError") });
    } finally {
      setMetaBusy(false);
    }
  }

  // Courier CSV
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [preview, setPreview] = useState<CourierPreview | null>(null);
  const [applied, setApplied] = useState<CourierPreview | null>(null);

  async function sendCsv(text: string, apply: boolean) {
    setCsvBusy(true);
    try {
      const res = await fetch("/api/profit/courier-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, apply, storeId: c?.shopify.storeId }),
      });
      const json = (await res.json().catch(() => ({}))) as CourierPreview;
      if (!res.ok) json.error = json.error ?? t("genericError");
      if (apply) {
        setApplied(json);
        if (res.ok) {
          setPreview(null);
          setCsv(null);
          setFileName("");
          await onChanged();
        }
      } else {
        setPreview(json);
      }
    } catch {
      (apply ? setApplied : setPreview)({ error: t("genericError") });
    } finally {
      setCsvBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setApplied(null);
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    await sendCsv(text, false);
  }

  function downloadTemplate() {
    const blob = new Blob([COURIER_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-courier.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const lockedNote = <p className="mt-auto pt-2 text-[12px] text-[#8a8177]">{t("needsShopify")}</p>;

  return (
    <section
      id="profit-shopify-connect"
      aria-labelledby="rp-connect-title"
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-[#ece7e0] bg-[linear-gradient(160deg,#fffaf6_0%,#ffffff_50%,#faf8f5_100%)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ece7e0] px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <a
              id="rp-connect-title"
              href={realProfitUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-[1.35rem] font-bold tracking-[-0.03em] text-[#1c1917] hover:text-[#ff781f]"
            >
              Real Profit COD
              <svg viewBox="0 0 20 20" className="h-4 w-4 opacity-50 transition group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M7 13 13 7M8 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              {t("free")}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-[#5c564e]">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2" aria-label={t("progress", { done: connectedCount, total: 4 })}>
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i < connectedCount ? "bg-[#ff781f]" : "bg-[#ece7e0]"}`} />
            ))}
          </div>
          <span className="text-[12px] font-semibold tabular-nums text-[#5c564e]">
            {t("progress", { done: connectedCount, total: 4 })}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        {/* 1 · Shopify */}
        <SourceCard
          step={1}
          logo={logos.shopify}
          title={t("shopifyTitle")}
          status={shopifyOn ? <StatusPill tone="ok">{t("connected")}</StatusPill> : <StatusPill tone="todo">{t("pending")}</StatusPill>}
        >
          {shopifyOn ? (
            <p>
              <span className="font-semibold text-[#1c1917]">{c?.shopify.storeName}</span>
              {c?.shopify.shopDomain ? <span className="text-[#8a8177]"> · {c.shopify.shopDomain}</span> : null}
              <br />
              {t("shopifyOnBody")}
            </p>
          ) : (
            <>
              <p>{t("shopifyBody")}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputClass}
                  placeholder={t("shopifyPlaceholder")}
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  inputMode="url"
                  autoComplete="off"
                  aria-label={t("shopifyPlaceholder")}
                />
                {installHref ? (
                  <a href={installHref} target="_blank" rel="noreferrer" className={primaryBtn}>
                    {t("shopifyInstall")}
                  </a>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void retryLink()} disabled={linkBusy} className="text-[12px] font-semibold text-[#c2410c] underline-offset-2 hover:underline disabled:opacity-50">
                  {linkBusy ? t("checking") : t("shopifyAlready")}
                </button>
              </div>
              {linkMsg ? (
                <p className={`mt-2 text-[12px] font-medium ${linkMsg.ok ? "text-emerald-700" : "text-[#b91c1c]"}`}>{linkMsg.text}</p>
              ) : null}
            </>
          )}
        </SourceCard>

        {/* 2 · TikTok Ads */}
        <SourceCard
          step={2}
          logo={logos.tiktok}
          title={t("tiktokTitle")}
          status={
            !c?.tiktok.connected ? (
              <StatusPill tone="locked">{t("noAccounts")}</StatusPill>
            ) : tiktokLinked ? (
              <StatusPill tone="ok">{t("connected")}</StatusPill>
            ) : (
              <StatusPill tone="todo">{t("pending")}</StatusPill>
            )
          }
        >
          {!c?.tiktok.connected ? (
            <p>{t("tiktokOffBody")}</p>
          ) : tiktokLinked ? (
            <>
              <p>{t("tiktokOnBody", { count: c.tiktok.accounts })}</p>
              <button
                type="button"
                onClick={() => onTikTokLinkedChange(false)}
                className="mt-2 self-start text-[12px] font-semibold text-[#8a8177] underline-offset-2 hover:underline"
              >
                {t("tiktokHide")}
              </button>
            </>
          ) : (
            <>
              <p>{t("tiktokConnectBody", { count: c.tiktok.accounts })}</p>
              <button
                type="button"
                onClick={() => onTikTokLinkedChange(true)}
                className={`${primaryBtn} mt-3 self-start`}
              >
                {t("tiktokConnect")}
              </button>
            </>
          )}
        </SourceCard>

        {/* 3 · Meta Ads */}
        <SourceCard
          step={3}
          logo={logos.meta}
          title={t("metaTitle")}
          status={
            c?.meta.connected ? (
              <StatusPill tone="ok">{t("connected")}</StatusPill>
            ) : shopifyOn ? (
              <StatusPill tone="todo">{t("pending")}</StatusPill>
            ) : (
              <StatusPill tone="locked">{t("locked")}</StatusPill>
            )
          }
        >
          {c?.meta.connected && !metaEditing ? (
            <>
              <p>
                <span className="font-semibold text-[#1c1917]">{c.meta.accountName}</span>
                <br />
                {c.meta.lastSyncError ? (
                  <span className="text-[#b91c1c]">{c.meta.lastSyncError}</span>
                ) : (
                  t("metaOnBody")
                )}
              </p>
              <button type="button" onClick={() => setMetaEditing(true)} className="mt-2 self-start text-[12px] font-semibold text-[#c2410c] underline-offset-2 hover:underline">
                {t("metaChange")}
              </button>
            </>
          ) : !shopifyOn ? (
            <>
              <p>{t("metaBody")}</p>
              {lockedNote}
            </>
          ) : (
            <>
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>
                  {t("metaStep1")}
                  <span className="mt-1.5 flex items-center gap-2">
                    <code className="rounded-lg bg-[#faf8f5] px-2 py-1 text-[12.5px] font-bold tabular-nums text-[#1c1917] ring-1 ring-[#ece7e0]">
                      {META_PARTNER_BUSINESS_ID}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(META_PARTNER_BUSINESS_ID);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1800);
                      }}
                      className="text-[12px] font-semibold text-[#c2410c] hover:underline"
                    >
                      {copied ? t("copied") : t("copy")}
                    </button>
                  </span>
                </li>
                <li>{t("metaStep2")}</li>
              </ol>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputClass}
                  placeholder={t("metaPlaceholder")}
                  value={adAccount}
                  onChange={(e) => setAdAccount(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={t("metaPlaceholder")}
                />
                <button type="button" onClick={() => void connectMeta()} disabled={metaBusy || adAccount.replace(/\D/g, "").length < 5} className={primaryBtn}>
                  {metaBusy ? t("checking") : t("metaConnect")}
                </button>
              </div>
              {metaMsg ? (
                <p className={`mt-2 text-[12px] font-medium ${metaMsg.ok ? "text-emerald-700" : "text-[#b91c1c]"}`}>{metaMsg.text}</p>
              ) : null}
            </>
          )}
        </SourceCard>

        {/* 4 · Courier CSV */}
        <SourceCard
          step={4}
          logo={logos.courier}
          title={t("courierTitle")}
          status={
            (c?.courier.ordersFromCourier ?? 0) > 0 ? (
              <StatusPill tone="ok">{t("courierCount", { count: c!.courier.ordersFromCourier })}</StatusPill>
            ) : shopifyOn ? (
              <StatusPill tone="todo">{t("pending")}</StatusPill>
            ) : (
              <StatusPill tone="locked">{t("locked")}</StatusPill>
            )
          }
        >
          <p>{t("courierBody")}</p>
          {!shopifyOn ? (
            lockedNote
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={csvBusy} className={primaryBtn}>
                  {csvBusy && !preview ? t("reading") : t("courierUpload")}
                </button>
                <button type="button" onClick={downloadTemplate} className={ghostBtn}>
                  {t("courierTemplate")}
                </button>
              </div>

              {preview ? (
                <div className="mt-3 rounded-xl border border-[#ece7e0] bg-[#faf8f5] p-3">
                  {preview.error && !preview.matched ? (
                    <p className="font-medium text-[#b91c1c]">{preview.error}</p>
                  ) : (
                    <>
                      <p className="font-semibold text-[#1c1917]">
                        {fileName ? `${fileName} · ` : ""}
                        {t("courierMatched", { matched: preview.matched ?? 0, total: preview.totalRows ?? 0 })}
                      </p>
                      {preview.byStatus ? (
                        <p className="mt-1 text-[12px] text-[#5c564e]">
                          {Object.entries(preview.byStatus)
                            .map(([k, v]) => `${t(`status.${k}` as never)}: ${v}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {preview.notFound ? (
                        <p className="mt-1 text-[12px] text-[#8a8177]">{t("courierNotFound", { count: preview.notFound })}</p>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => csv && void sendCsv(csv, true)}
                          disabled={csvBusy || !preview.matched}
                          className={primaryBtn}
                        >
                          {csvBusy ? t("applying") : t("courierApply")}
                        </button>
                        <button type="button" onClick={() => { setPreview(null); setCsv(null); setFileName(""); }} className={ghostBtn}>
                          {t("cancel")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
              {applied ? (
                <p className={`mt-2 text-[12px] font-medium ${applied.error ? "text-[#b91c1c]" : "text-emerald-700"}`}>
                  {applied.error ?? applied.message}
                </p>
              ) : null}
            </>
          )}
        </SourceCard>
      </div>
    </section>
  );
}
