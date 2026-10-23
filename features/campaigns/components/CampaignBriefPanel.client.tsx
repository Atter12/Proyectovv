"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { BriefResult } from "@/lib/campaigns/campaign-brief.server";
import { COUNTRY_LOCATION_IDS, type CampaignCountry } from "@/lib/campaigns/smart-plus-plan";

const COUNTRIES = Object.keys(COUNTRY_LOCATION_IDS) as CampaignCountry[];
/** Mensajes que rotan mientras la IA trabaja (lectura + IA tardan ~10-20 s). */
const STEPS = ["reading", "writing", "budget"] as const;
const MAX_LAUNCH_TEXTS = 5;

export type CampaignBriefEvent = {
  texts: string[];
  landingPageUrl: string;
  dailyBudget: number;
  campaignName: string;
  country: CampaignCountry;
};

export type StudioBriefEvent = BriefResult["brief"]["studio"] & { images: string[] };

/** Fotos de la tienda por nuestro dominio (la CSP no deja cargar dominios ajenos). */
export function productImageSrc(url: string): string {
  return `/api/campaigns/brief/image?url=${encodeURIComponent(url)}`;
}

const money = (amount: number, currency: string | null) => {
  try {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: currency ?? "USD", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`.trim();
  }
};

/**
 * Asistente de campañas: el cliente pega el link de su producto y la IA arma
 * los textos, el guion del video y el presupuesto. Con un clic llena "Lanzar
 * campaña" (y "Crear video" para el equipo); nada se crea sin revisarlo.
 */
export function CampaignBriefPanel({ showVideoStudio = false }: { showVideoStudio?: boolean }) {
  const t = useTranslations("creatives.brief");
  const [url, setUrl] = useState("");
  const [country, setCountry] = useState<CampaignCountry>("PE");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BriefResult | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [sent, setSent] = useState<"launch" | "studio" | null>(null);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4500);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function generate() {
    setLoading(true);
    setStep(0);
    setError(null);
    setResult(null);
    setSent(null);
    try {
      const response = await fetch("/api/campaigns/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, country }),
      });
      const data = (await response.json()) as BriefResult & { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? t("errors.generic"));
        return;
      }
      setResult(data);
      // Por defecto, los textos sin frases riesgosas.
      setPicked(data.brief.texts.map((x, i) => (x.risky ? -1 : i)).filter((i) => i >= 0).slice(0, MAX_LAUNCH_TEXTS));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setPicked((list) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i].sort((a, b) => a - b)));
  }

  function sendToLaunch() {
    if (!result) return;
    const detail: CampaignBriefEvent = {
      texts: picked.map((i) => result.brief.texts[i].text).slice(0, MAX_LAUNCH_TEXTS),
      landingPageUrl: result.product.url,
      dailyBudget: result.budget.amount,
      campaignName: result.brief.campaignName,
      country,
    };
    window.dispatchEvent(new CustomEvent<CampaignBriefEvent>("campaign-brief", { detail }));
    setSent("launch");
    document.getElementById("launch-campaign")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function sendToStudio() {
    if (!result) return;
    const detail: StudioBriefEvent = { ...result.brief.studio, images: result.product.images };
    window.dispatchEvent(new CustomEvent<StudioBriefEvent>("studio-brief", { detail }));
    setSent("studio");
    document.getElementById("video-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const product = result?.product;
  const budgetReason = result
    ? t(`budget.${result.budget.reason}`, {
        cpr: result.budget.costPerResult !== null ? money(result.budget.costPerResult, "USD") : "",
      })
    : "";

  return (
    <section
      id="campaign-brief"
      className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] bg-[linear-gradient(135deg,#fff7f0_0%,#ffffff_60%)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">{t("kicker")}</p>
        <h2 className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">{t("title")}</h2>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">{t("subtitle")}</p>
      </div>

      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <form
          className="flex flex-col gap-2.5 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() && !loading) void generate();
          }}
        >
          <Input
            value={url}
            inputMode="url"
            disabled={loading}
            placeholder={t("urlPlaceholder")}
            onChange={(e) => setUrl(e.target.value)}
            className="h-11 flex-1 border-[rgb(20_18_16_/_0.1)] text-[13px]"
          />
          <select
            value={country}
            disabled={loading}
            onChange={(e) => setCountry(e.target.value as CampaignCountry)}
            aria-label={t("country")}
            className="h-11 rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white px-3 text-[13px] text-[var(--auth-text)] sm:w-36"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {t(`countries.${c}`)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="h-11 rounded-xl bg-[var(--auth-accent)] px-5 text-[13px] font-bold text-white transition disabled:opacity-50"
          >
            {loading ? t("generating") : result ? t("again") : t("generate")}
          </button>
        </form>

        {loading ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-[rgb(255_248_243_/_0.8)] px-4 py-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--auth-accent)] border-t-transparent" />
            <p className="text-[13px] font-medium text-[var(--auth-text)]">{t(`steps.${STEPS[step]}`)}</p>
          </div>
        ) : null}
        {error ? <p className="mt-4 rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]">{error}</p> : null}

        {result && product ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-4">
              <div className="flex gap-3.5 rounded-2xl border border-[rgb(20_18_16_/_0.08)] p-3">
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productImageSrc(product.images[0])}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-xl bg-[#f4f1ed] object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[14px] font-semibold text-[var(--auth-text)]">{product.title}</p>
                  {product.price !== null ? (
                    <p className="mt-1 text-[15px] font-bold text-[var(--auth-accent)]">
                      {money(product.price, product.currency)}
                      {product.oldPrice !== null ? (
                        <span className="ml-2 text-[12px] font-medium text-[var(--auth-text-muted)] line-through">
                          {money(product.oldPrice, product.currency)}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[var(--auth-text-muted)]">
                    {t("photos", { count: product.images.length })}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#ecf7f0] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f5c40]">{t("budget.title")}</p>
                <p className="font-display mt-1 text-[1.5rem] font-semibold text-[#1f5c40]">
                  {t("budget.amount", { amount: money(result.budget.amount, "USD") })}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[#2f6b4f]">{budgetReason}</p>
              </div>

              <div className="rounded-2xl border border-[rgb(20_18_16_/_0.08)] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">{t("script.title")}</p>
                <p className="mt-2 text-[14px] font-semibold text-[var(--auth-text)]">{result.brief.studio.hook}</p>
                <ul className="mt-2 space-y-1">
                  {result.brief.studio.benefits.filter(Boolean).map((b) => (
                    <li key={b} className="flex gap-2 text-[13px] text-[var(--auth-text)]">
                      <span className="text-[var(--auth-accent)]">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] font-semibold text-[var(--auth-accent)]">{result.brief.studio.cta}</p>
                {showVideoStudio ? (
                  <button
                    type="button"
                    onClick={sendToStudio}
                    className="mt-3 h-9 rounded-xl border border-[rgb(20_18_16_/_0.12)] px-3.5 text-[12px] font-semibold text-[var(--auth-text)]"
                  >
                    {t("toStudio")}
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
                {t("texts.title", { count: picked.length, max: MAX_LAUNCH_TEXTS })}
              </p>
              <ul className="mt-2 space-y-2">
                {result.brief.texts.map((item, i) => {
                  const on = picked.includes(i);
                  return (
                    <li key={item.text}>
                      <button
                        type="button"
                        onClick={() => toggle(i)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                          on ? "border-[var(--auth-accent)] bg-[rgb(255_248_243_/_0.8)]" : "border-[rgb(20_18_16_/_0.08)] bg-white",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 text-[11px] font-bold text-white",
                            on ? "border-[var(--auth-accent)] bg-[var(--auth-accent)]" : "border-[rgb(20_18_16_/_0.2)]",
                          )}
                        >
                          {on ? "✓" : ""}
                        </span>
                        <span className="min-w-0">
                          <span className="text-[13px] leading-5 text-[var(--auth-text)]">{item.text}</span>
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded-md bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-text-muted)]">
                              {item.angle}
                            </span>
                            {item.risky ? (
                              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                {t("texts.risky", { reason: item.risky })}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={picked.length === 0}
                  onClick={sendToLaunch}
                  className="h-11 rounded-xl bg-[var(--auth-text)] px-5 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  {t("toLaunch")}
                </button>
                {sent ? <p className="text-[12px] font-semibold text-[#1f5c40]">{t(sent === "launch" ? "sentLaunch" : "sentStudio")}</p> : null}
              </div>
              <p className="mt-2 text-[11px] text-[var(--auth-text-muted)]">{t("reviewHint")}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
