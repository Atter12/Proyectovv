"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { CreativeAccountOption } from "@/lib/creatives/types";
import {
  STUDIO_DURATION,
  STUDIO_HEIGHT,
  STUDIO_MAX_BENEFITS,
  STUDIO_MAX_MEDIA,
  STUDIO_WIDTH,
  buildStudioTimeline,
  buildVoiceoverScript,
  formatStudioPrice,
  studioFileName,
  validateStudioInput,
  type StudioCurrency,
  type StudioInput,
  type StudioTemplate,
  type StudioVoice,
} from "@/lib/creatives/video-studio";
import {
  drawStudioFrame,
  isLowResolution,
  loadStudioMedia,
  recordStudioVideo,
  supportedStudioMimeType,
  type StudioMedia,
} from "@/lib/creatives/video-studio-render.client";

type Loaded = { id: string; name: string; url: string; media: StudioMedia };

const TEMPLATES: StudioTemplate[] = ["auto", "orange", "dark", "fresh"];
const TEMPLATE_SWATCH: Record<StudioTemplate, string> = {
  auto: "bg-[conic-gradient(#ff781f,#19c2b3,#6366f1,#ff781f)]",
  orange: "bg-[#ff781f]",
  dark: "bg-[#141416]",
  fresh: "bg-[#19c2b3]",
};
const CURRENCIES: StudioCurrency[] = ["PEN", "USD", "COP"];
const VOICES: StudioVoice[] = ["female", "male", "none"];

/** Pide la voz de cada frase del guion (en paralelo). */
async function fetchVoiceover(studio: StudioInput, mediaCount: number, voice: Exclude<StudioVoice, "none">) {
  const scenes = buildStudioTimeline({
    mediaCount,
    benefits: studio.benefits,
    hasPrice: Boolean(formatStudioPrice(studio.price, studio.currency)),
  });
  return Promise.all(
    buildVoiceoverScript(studio, scenes).map(async (line) => {
      const response = await fetch("/api/creatives/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line.text, voice }),
      });
      if (!response.ok) throw new Error("voice");
      return { at: line.at, audio: await response.arrayBuffer() };
    }),
  );
}
/** Límite de subida de la API (Vercel corta en 4.5 MB). */
const MAX_UPLOAD_BYTES = 4.3 * 1024 * 1024;

const noopSubscribe = () => () => {};

const labelClass =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]";
const fieldClass = "h-10 border-[rgb(20_18_16_/_0.1)] text-[13px]";

/** Arma un video vertical de 15 s con las fotos del producto y lo manda al flujo de Agent Pro. */
export function VideoStudioPanel({
  clienteName,
  accounts = [],
}: {
  clienteName?: string;
  accounts?: CreativeAccountOption[];
}) {
  const t = useTranslations("creatives.videoStudio");
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recordingRef = useRef(false);

  const [items, setItems] = useState<Loaded[]>([]);
  const [studio, setStudio] = useState<StudioInput>(() => ({
    template: "auto",
    hook: "",
    productName: "",
    benefits: ["", "", ""],
    price: "",
    oldPrice: "",
    currency: "PEN",
    promo: "",
    cta: t("defaults.cta"),
    storeName: clienteName ?? "",
    labels: { before: t("canvas.before"), today: t("canvas.today"), price: t("canvas.price"), button: t("canvas.button") },
  }));
  const [adAccountId, setAdAccountId] = useState(
    () => accounts.find((a) => a.status === "active")?.id ?? accounts[0]?.id ?? "",
  );
  const [phase, setPhase] = useState<"edit" | "voice" | "recording" | "ready" | "uploading">("edit");
  const [voice, setVoice] = useState<StudioVoice>("female");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // En el servidor se asume que sí; el navegador dice la verdad al hidratar.
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => supportedStudioMimeType() !== null,
    () => true,
  );

  const media = useMemo(() => items.map((i) => i.media), [items]);

  // Vista previa en bucle mientras se edita (la grabación dibuja por su cuenta).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || phase === "recording") return;
    for (const m of media) if (m.kind === "video") void m.el.play().catch(() => undefined);
    let frame = 0;
    const start = performance.now();
    const loop = () => {
      if (recordingRef.current) return;
      const tt = ((performance.now() - start) / 1000) % STUDIO_DURATION;
      drawStudioFrame(ctx, tt, studio, media);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [studio, media, phase]);

  // Libera los archivos al salir.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const i of itemsRef.current) URL.revokeObjectURL(i.url);
    },
    [],
  );
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  function update<K extends keyof StudioInput>(key: K, value: StudioInput[K]) {
    setStudio((prev) => ({ ...prev, [key]: value }));
    if (result) setResult(null);
    if (phase === "ready") setPhase("edit");
    setSuccess(null);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = STUDIO_MAX_MEDIA - items.length;
    const picked = [...files].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/")).slice(0, room);
    const loaded: Loaded[] = [];
    for (const file of picked) {
      try {
        const { media: m, url } = await loadStudioMedia(file);
        loaded.push({ id: `${file.name}-${file.size}-${Math.random()}`, name: file.name, url, media: m });
      } catch {
        setError(t("errors.mediaLoad", { name: file.name }));
      }
    }
    if (files.length > room) setError(t("errors.tooMany", { max: STUDIO_MAX_MEDIA }));
    setItems((prev) => [...prev, ...loaded]);
    setResult(null);
    setPhase("edit");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((i) => i.id !== id);
    });
    setResult(null);
    setPhase("edit");
  }

  async function handleRecord() {
    const problems = validateStudioInput(studio, items.length);
    if (problems.length > 0) {
      setError(t(`errors.${problems[0]}`));
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError(null);
    setSuccess(null);
    setProgress(0);
    let voiceLines: { at: number; audio: ArrayBuffer }[] = [];
    if (voice !== "none") {
      setPhase("voice");
      try {
        voiceLines = await fetchVoiceover(studio, items.length, voice);
      } catch {
        setError(t("errors.voice"));
        setPhase("edit");
        return;
      }
    }
    setPhase("recording");
    recordingRef.current = true;
    try {
      const blob = await recordStudioVideo({ canvas, studio, media, voice: voiceLines, onProgress: setProgress });
      setResult({ blob, url: URL.createObjectURL(blob) });
      setPhase("ready");
    } catch (recordError) {
      setError(
        recordError instanceof Error && recordError.message === "unsupported"
          ? t("errors.unsupported")
          : t("errors.record"),
      );
      setPhase("edit");
    } finally {
      recordingRef.current = false;
    }
  }

  async function handleSend() {
    if (!result) return;
    if (!adAccountId) {
      setError(t("errors.noAccount"));
      return;
    }
    if (result.blob.size > MAX_UPLOAD_BYTES) {
      setError(t("errors.tooBig"));
      return;
    }
    setPhase("uploading");
    setError(null);
    try {
      const fileName = studioFileName(studio.productName);
      const formData = new FormData();
      formData.append("asset", new File([result.blob], fileName, { type: "video/mp4" }));
      formData.append(
        "name",
        clienteName ? `${clienteName} · ${t("assetName", { product: studio.productName.trim() })}` : t("assetName", { product: studio.productName.trim() }),
      );
      formData.append("adAccountId", adAccountId);
      const selected = accounts.find((a) => a.id === adAccountId);
      if (selected?.externalAccountId) formData.append("advertiserId", selected.externalAccountId);
      await apiClient("/api/creative-assets", { method: "POST", body: formData });
      setSuccess(t("sent"));
      setResult(null);
      setPhase("edit");
      router.refresh();
    } catch (sendError) {
      setError(sendError instanceof ApiClientError ? sendError.message : t("errors.send"));
      setPhase("ready");
    }
  }

  const approved = accounts.filter((a) => a.status === "active");
  const accountChoices = approved.length > 0 ? approved : accounts;
  const busy = phase === "voice" || phase === "recording" || phase === "uploading";

  return (
    <section
      id="video-studio"
      className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">{t("kicker")}</p>
        <h2 className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
          {t("title")}
        </h2>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">{t("subtitle")}</p>
      </div>

      {!supported ? (
        <p className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950 sm:mx-6">
          {t("errors.unsupported")}
        </p>
      ) : null}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
        <div className="grid gap-4 px-5 py-4 sm:px-6 sm:py-5">
          {/* Fotos y clips */}
          <div>
            <label className={labelClass}>{t("mediaLabel", { max: STUDIO_MAX_MEDIA })}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => void addFiles(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="group relative h-24 w-[3.4rem] overflow-hidden rounded-lg bg-black/80"
                  title={item.name}
                >
                  {item.media.kind === "video" ? (
                    <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  {isLowResolution(item.media) ? (
                    <span className="absolute inset-x-0 bottom-0 bg-amber-500/90 py-0.5 text-center text-[9px] font-bold text-white">
                      {t("lowResBadge")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeItem(item.id)}
                    aria-label={t("remove")}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[11px] font-bold text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {items.length < STUDIO_MAX_MEDIA ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-24 w-[3.4rem] place-items-center rounded-lg border border-dashed border-[rgb(20_18_16_/_0.18)] bg-[rgb(255_248_243_/_0.6)] text-[22px] font-semibold text-[var(--auth-accent)] hover:border-[var(--auth-accent)]"
                  aria-label={t("addMedia")}
                >
                  +
                </button>
              ) : null}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--auth-text-muted)]">{t("mediaHint")}</p>
            {items.some((i) => isLowResolution(i.media)) ? (
              <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                {t("lowRes")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("hook")}</label>
              <Input
                value={studio.hook}
                maxLength={60}
                disabled={busy}
                onChange={(e) => update("hook", e.target.value)}
                placeholder={t("hookPlaceholder")}
                className={fieldClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("product")}</label>
              <Input
                value={studio.productName}
                maxLength={50}
                disabled={busy}
                onChange={(e) => update("productName", e.target.value)}
                placeholder={t("productPlaceholder")}
                className={fieldClass}
              />
            </div>
            {Array.from({ length: STUDIO_MAX_BENEFITS }, (_, i) => (
              <div key={i} className={i === 0 ? "sm:col-span-2" : undefined}>
                <label className={labelClass}>{t("benefit", { n: i + 1 })}</label>
                <Input
                  value={studio.benefits[i] ?? ""}
                  maxLength={32}
                  disabled={busy}
                  onChange={(e) => {
                    const next = [...studio.benefits];
                    next[i] = e.target.value;
                    update("benefits", next);
                  }}
                  placeholder={t(`benefitPlaceholder${i + 1}` as "benefitPlaceholder1")}
                  className={fieldClass}
                />
              </div>
            ))}
            <div>
              <label className={labelClass}>{t("price")}</label>
              <div className="flex gap-2">
                <select
                  value={studio.currency}
                  disabled={busy}
                  onChange={(e) => update("currency", e.target.value as StudioCurrency)}
                  className="h-10 rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white px-2 text-[13px] text-[var(--auth-text)]"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`currency.${c}`)}
                    </option>
                  ))}
                </select>
                <Input
                  value={studio.price}
                  inputMode="decimal"
                  disabled={busy}
                  onChange={(e) => update("price", e.target.value)}
                  placeholder="89"
                  className={fieldClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("oldPrice")}</label>
              <Input
                value={studio.oldPrice}
                inputMode="decimal"
                disabled={busy}
                onChange={(e) => update("oldPrice", e.target.value)}
                placeholder="129"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("promo")}</label>
              <Input
                value={studio.promo}
                maxLength={24}
                disabled={busy}
                onChange={(e) => update("promo", e.target.value)}
                placeholder={t("promoPlaceholder")}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("cta")}</label>
              <Input
                value={studio.cta}
                maxLength={40}
                disabled={busy}
                onChange={(e) => update("cta", e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("store")}</label>
              <Input
                value={studio.storeName}
                maxLength={40}
                disabled={busy}
                onChange={(e) => update("storeName", e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("template")}</label>
              <div className="flex flex-wrap items-center gap-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    disabled={busy}
                    onClick={() => update("template", tpl)}
                    className={cn(
                      "flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[12px] font-semibold",
                      studio.template === tpl
                        ? "border-[var(--auth-accent)] bg-[rgb(255_248_243)] text-[var(--auth-text)]"
                        : "border-[rgb(20_18_16_/_0.1)] text-[var(--auth-text-muted)]",
                    )}
                  >
                    <span className={cn("h-3.5 w-3.5 rounded-full", TEMPLATE_SWATCH[tpl])} />
                    {t(`templates.${tpl}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("voice")}</label>
              <div className="flex flex-wrap items-center gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setVoice(v);
                      setResult(null);
                      if (phase === "ready") setPhase("edit");
                    }}
                    className={cn(
                      "flex h-9 items-center rounded-xl border px-3 text-[12px] font-semibold",
                      voice === v
                        ? "border-[var(--auth-accent)] bg-[rgb(255_248_243)] text-[var(--auth-text)]"
                        : "border-[rgb(20_18_16_/_0.1)] text-[var(--auth-text-muted)]",
                    )}
                  >
                    {t(`voices.${v}`)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--auth-text-muted)]">{t("voiceHint")}</p>
            </div>
          </div>

          <div>
            <label className={labelClass}>{t("account")}</label>
            {accountChoices.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                {t("errors.noAccount")}
              </p>
            ) : (
              <select
                value={adAccountId}
                disabled={busy}
                onChange={(e) => setAdAccountId(e.target.value)}
                className="h-10 w-full rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white px-3 text-[13px] text-[var(--auth-text)]"
              >
                {accountChoices.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.bmLabel ? ` · ${account.bmLabel}` : ""}
                    {account.status !== "active" ? ` · ${account.status}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error ? (
            <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-lg bg-[#ecf7f0] px-3 py-2 text-[13px] text-[#1f5c40]">{success}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {phase === "ready" || phase === "uploading" ? (
              <>
                <Button
                  onClick={handleSend}
                  disabled={busy}
                  className="h-11 rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] hover:brightness-[1.05]"
                >
                  {phase === "uploading" ? t("sending") : t("send")}
                </Button>
                {result ? (
                  <a
                    href={result.url}
                    download={studioFileName(studio.productName)}
                    className="inline-flex h-11 items-center rounded-xl border border-[rgb(20_18_16_/_0.12)] px-4 text-[14px] font-semibold text-[var(--auth-text)] hover:bg-[rgb(255_248_243_/_0.7)]"
                  >
                    {t("download")}
                  </a>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setPhase("edit");
                  }}
                  disabled={busy}
                  className="h-11 rounded-xl border-[rgb(20_18_16_/_0.12)] px-4 text-[14px] font-semibold text-[var(--auth-text)]"
                >
                  {t("edit")}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleRecord}
                disabled={busy || !supported}
                className="h-11 rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] hover:brightness-[1.05]"
              >
                {phase === "voice"
                  ? t("voicing")
                  : phase === "recording"
                    ? t("recording", { pct: Math.round(progress * 100) })
                    : t("create")}
              </Button>
            )}
          </div>
          {phase === "recording" ? (
            <p className="text-[12px] text-[var(--auth-text-muted)]">{t("recordingHint")}</p>
          ) : null}
        </div>

        <aside className="flex flex-col items-center gap-3 border-t border-[rgb(20_18_16_/_0.06)] bg-[rgb(255_248_243_/_0.65)] px-5 py-5 lg:border-l lg:border-t-0">
          <p className="self-start text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-text-soft)]">
            {phase === "ready" ? t("resultTitle") : t("previewTitle")}
          </p>
          <div className="relative w-full max-w-[240px] overflow-hidden rounded-[1.4rem] bg-black shadow-[0_18px_40px_rgb(20_18_16_/_0.18)]">
            {result && phase !== "recording" ? (
              <video src={result.url} className="aspect-[9/16] w-full" controls playsInline />
            ) : null}
            <canvas
              ref={canvasRef}
              width={STUDIO_WIDTH}
              height={STUDIO_HEIGHT}
              className={cn("aspect-[9/16] w-full", result && phase !== "recording" ? "hidden" : "block")}
            />
            {phase === "recording" ? (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                <div className="h-full bg-[var(--auth-accent)]" style={{ width: `${progress * 100}%` }} />
              </div>
            ) : null}
          </div>
          <p className="text-center text-[11px] leading-4 text-[var(--auth-text-muted)]">{t("previewHint")}</p>
        </aside>
      </div>
    </section>
  );
}
