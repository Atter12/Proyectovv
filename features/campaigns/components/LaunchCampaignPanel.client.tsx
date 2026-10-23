"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { CreativeAccountOption } from "@/lib/creatives/types";
import type { LaunchOptions } from "@/lib/campaigns/launch-options.server";
import { COUNTRY_LOCATION_IDS, MIN_DAILY_BUDGET, type CampaignCountry } from "@/lib/campaigns/smart-plus-plan";

type CreateResponse =
  | { ok: true; campaignId: string; adgroupId: string; adId: string; advertiserId: string }
  | { ok: false; step?: string; errors?: string[]; message?: string; error?: string; campaignId?: string };

const COUNTRIES = Object.keys(COUNTRY_LOCATION_IDS) as CampaignCountry[];
/** Opción para crear un perfil propio de la cuenta con el nombre de la tienda. */
const NEW_IDENTITY = "NEW";
/** Smart+ prueba varios videos y se queda con el que vende; más de 10 no ayuda. */
const MAX_PICK = 10;

const labelClass = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]";
const fieldClass = "h-10 border-[rgb(20_18_16_/_0.1)] text-[13px]";
const selectClass =
  "h-10 w-full rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white px-3 text-[13px] text-[var(--auth-text)]";

function todayLabel(): string {
  return new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

/**
 * Lanza una campaña Smart+ de ventas web en la cuenta elegida, con el molde de
 * las campañas que más venden. Queda pausada en TikTok para revisarla.
 */
export function LaunchCampaignPanel({
  clienteName,
  accounts = [],
}: {
  clienteName?: string;
  accounts?: CreativeAccountOption[];
}) {
  const t = useTranslations("creatives.launch");
  const approved = accounts.filter((a) => a.status === "active");
  const [adAccountId, setAdAccountId] = useState(approved[0]?.id ?? "");
  const [options, setOptions] = useState<LaunchOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(() => Boolean(approved[0]?.id));
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [pixelId, setPixelId] = useState("");
  const [identityKey, setIdentityKey] = useState("");
  const [campaignName, setCampaignName] = useState(() => `${clienteName ?? t("defaultName")} · ${todayLabel()}`);
  const [dailyBudget, setDailyBudget] = useState(String(MIN_DAILY_BUDGET));
  const [country, setCountry] = useState<CampaignCountry>("PE");
  const [texts, setTexts] = useState(["", ""]);
  const [landingPageUrl, setLandingPageUrl] = useState("");

  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateResponse | null>(null);

  useEffect(() => {
    if (!adAccountId) return;
    let cancelled = false;
    fetch(`/api/campaigns/launch?adAccountId=${encodeURIComponent(adAccountId)}`)
      .then(async (response) => {
        const data = (await response.json()) as LaunchOptions & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setOptionsError(data.error ?? t("errors.options"));
          return;
        }
        setOptions(data);
        setPixelId(data.pixels[0]?.id ?? "");
        const first = data.identities[0];
        setIdentityKey(first ? `${first.type}:${first.id}` : NEW_IDENTITY);
        setVideoIds(data.videos.slice(0, 1).map((v) => v.videoId));
      })
      .catch(() => {
        if (!cancelled) setOptionsError(t("errors.options"));
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adAccountId, t]);

  function changeAccount(id: string) {
    setAdAccountId(id);
    setLoadingOptions(true);
    setOptionsError(null);
    setOptions(null);
    setResult(null);
  }

  function toggleVideo(id: string) {
    setVideoIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : prev.length >= MAX_PICK ? prev : [...prev, id],
    );
  }

  async function handleCreate() {
    const identity = options?.identities.find((i) => `${i.type}:${i.id}` === identityKey);
    const identityBody =
      identityKey === NEW_IDENTITY
        ? { type: "NEW", name: clienteName ?? campaignName }
        : identity
          ? { type: identity.type, id: identity.id, bcId: identity.bcId }
          : {};
    setCreating(true);
    setResult(null);
    try {
      const response = await fetch("/api/campaigns/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId,
          campaignName,
          dailyBudget: Number(dailyBudget),
          country,
          pixelId,
          videoIds,
          adTexts: texts,
          landingPageUrl,
          identity: identityBody,
        }),
      });
      const data = (await response.json()) as CreateResponse;
      setResult(data);
      // La lista de campañas lanzadas (abajo) se recarga para prenderla desde ahí.
      if (data.ok) window.dispatchEvent(new Event("campaign-launched"));
    } catch {
      setResult({ ok: false, message: t("errors.network") });
    } finally {
      setCreating(false);
    }
  }

  const resultError =
    result && !result.ok
      ? result.errors?.length
        ? result.errors.map((e) => t(`errors.${e}` as "errors.noPixel")).join(" ")
        : `${result.step ? `${t(`steps.${result.step}` as "steps.ad")}: ` : ""}${result.message ?? result.error ?? t("errors.network")}`
      : null;

  return (
    <section
      id="launch-campaign"
      className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">{t("kicker")}</p>
        <h2 className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
          {t("title")}
        </h2>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">{t("subtitle")}</p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
        <div className="grid gap-4 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <label className={labelClass}>{t("account")}</label>
            {approved.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                {t("errors.noAccount")}
              </p>
            ) : (
              <select value={adAccountId} disabled={creating} onChange={(e) => changeAccount(e.target.value)} className={selectClass}>
                {approved.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.bmLabel ? ` · ${account.bmLabel}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {loadingOptions ? (
            <p className="text-[13px] text-[var(--auth-text-muted)]">{t("loading")}</p>
          ) : optionsError ? (
            <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]">{optionsError}</p>
          ) : options ? (
            <>
              <div>
                <label className={labelClass}>{t("videos", { count: videoIds.length, max: MAX_PICK })}</label>
                {options.videos.length === 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                    {t("errors.noVideosInLibrary")}
                  </p>
                ) : (
                  <div className="flex max-h-[15rem] flex-wrap gap-2 overflow-y-auto">
                    {options.videos.map((video) => {
                      const on = videoIds.includes(video.videoId);
                      return (
                        <button
                          key={video.videoId}
                          type="button"
                          disabled={creating}
                          onClick={() => toggleVideo(video.videoId)}
                          title={video.name}
                          className={cn(
                            "relative h-28 w-[4.1rem] overflow-hidden rounded-lg bg-black/80 ring-2 transition",
                            on ? "ring-[var(--auth-accent)]" : "ring-transparent opacity-70 hover:opacity-100",
                          )}
                        >
                          {video.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
                          ) : null}
                          {on ? (
                            <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--auth-accent)] text-[11px] font-bold text-white">
                              ✓
                            </span>
                          ) : null}
                          {video.durationSec ? (
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
                              {video.durationSec}s
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-[var(--auth-text-muted)]">{t("videosHint")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t("name")}</label>
                  <Input value={campaignName} maxLength={100} disabled={creating} onChange={(e) => setCampaignName(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>{t("budget")}</label>
                  <Input
                    value={dailyBudget}
                    inputMode="decimal"
                    disabled={creating}
                    onChange={(e) => setDailyBudget(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("country")}</label>
                  <select value={country} disabled={creating} onChange={(e) => setCountry(e.target.value as CampaignCountry)} className={selectClass}>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`countries.${c}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t("pixel")}</label>
                  {options.pixels.length === 0 ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">{t("errors.noPixel")}</p>
                  ) : (
                    <select value={pixelId} disabled={creating} onChange={(e) => setPixelId(e.target.value)} className={selectClass}>
                      {options.pixels.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={labelClass}>{t("identity")}</label>
                  <select value={identityKey} disabled={creating} onChange={(e) => setIdentityKey(e.target.value)} className={selectClass}>
                    {options.identities.map((i) => (
                      <option key={`${i.type}:${i.id}`} value={`${i.type}:${i.id}`}>
                        {i.name}
                      </option>
                    ))}
                    <option value={NEW_IDENTITY}>{t("newIdentity", { name: clienteName ?? t("defaultName") })}</option>
                  </select>
                  <p className="mt-1.5 text-[11px] text-[var(--auth-text-muted)]">{t("identityHint")}</p>
                </div>
                {texts.map((text, i) => (
                  <div key={i} className="sm:col-span-2">
                    <label className={labelClass}>{t("text", { n: i + 1 })}</label>
                    <Input
                      value={text}
                      maxLength={100}
                      disabled={creating}
                      placeholder={t(i === 0 ? "textPlaceholder1" : "textPlaceholder2")}
                      onChange={(e) => setTexts((prev) => prev.map((v, k) => (k === i ? e.target.value : v)))}
                      className={fieldClass}
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t("landing")}</label>
                  <Input
                    value={landingPageUrl}
                    inputMode="url"
                    disabled={creating}
                    placeholder="https://tutienda.com/products/…"
                    onChange={(e) => setLandingPageUrl(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              {resultError ? (
                <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]" role="alert">
                  {resultError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleCreate}
                  disabled={creating || videoIds.length === 0}
                  className="h-11 rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] hover:brightness-[1.05]"
                >
                  {creating ? t("creating") : t("create")}
                </Button>
                <span className="text-[12px] text-[var(--auth-text-muted)]">{t("pausedNote")}</span>
              </div>
            </>
          ) : null}
        </div>

        <aside className="border-t border-[rgb(20_18_16_/_0.06)] bg-[rgb(255_248_243_/_0.65)] px-5 py-5 sm:px-6 lg:border-l lg:border-t-0">
          {result?.ok ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1f7a4d]">{t("done.kicker")}</p>
              <p className="mt-1.5 text-[16px] font-semibold text-[var(--auth-text)]">{t("done.title")}</p>
              <dl className="mt-3 space-y-1.5 text-[12px]">
                {(
                  [
                    ["campaign", result.campaignId],
                    ["adgroup", result.adgroupId],
                    ["ad", result.adId],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-[var(--auth-text-muted)]">{t(`done.${k}`)}</dt>
                    <dd className="font-mono text-[var(--auth-text)]">{v}</dd>
                  </div>
                ))}
              </dl>
              <a
                href={`https://ads.tiktok.com/i18n/perf/campaign?aadvid=${result.advertiserId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-10 items-center rounded-xl bg-[var(--auth-text)] px-4 text-[13px] font-semibold text-white"
              >
                {t("done.open")}
              </a>
              <p className="mt-3 text-[12px] leading-5 text-[var(--auth-text-muted)]">{t("done.next")}</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-text-soft)]">{t("recipeTitle")}</p>
              <ul className="mt-3 space-y-2.5">
                {(["recipe1", "recipe2", "recipe3", "recipe4", "recipe5"] as const).map((key) => (
                  <li key={key} className="flex items-start gap-2 text-[12px] font-medium leading-4 text-[var(--auth-text-muted)]">
                    <span aria-hidden className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--auth-accent)]" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
