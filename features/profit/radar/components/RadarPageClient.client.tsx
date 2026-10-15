"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { RadarProfile } from "@/lib/radar/profiles.server";
import type { RoundPayload, RoundVideo } from "@/lib/radar/round-builder.server";
import {
  RADAR_APPEARANCE,
  RADAR_CATEGORIES,
  RADAR_OBJECTIVES,
  type RadarAppearance,
  type RadarCategory,
  type RadarObjective,
} from "@/lib/radar/categories";
import { topPreferences } from "@/lib/radar/taste";
import { ProfitSectionSwitch } from "./ProfitSectionSwitch";
import { RadarVideoCard, type CardReaction } from "./RadarVideoCard.client";
import { RadarRecipeView } from "./RadarRecipeView.client";
import type { StoredRecipe } from "@/lib/radar/recipe.server";

type Step =
  | "intro"
  | "products"
  | "appear"
  | "objective"
  | "consent"
  | "round1"
  | "round2"
  | "done"
  | "skipped";

const ORDER: Step[] = ["intro", "products", "appear", "objective", "consent", "round1", "round2", "done"];
const GROUP = 3;
const MIN_ROUND1 = 6;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f5]";
/* Sin altura ni padding: en Tailwind v4 "h-11 … h-10" gana h-11 (orden del CSS), así que cada uso los fija. */
const primaryBase = `inline-flex items-center justify-center rounded-[12px] bg-[#17150f] text-[14px] font-semibold text-white transition-colors hover:bg-[#2b2620] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
const secondaryBase = `inline-flex items-center justify-center rounded-[12px] border border-[#e0d9d0] bg-white text-[14px] font-semibold text-[#1c1917] transition-colors hover:border-[#cfc6bb] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
const primaryBtn = `${primaryBase} h-11 px-5`;
const secondaryBtn = `${secondaryBase} h-11 px-5`;
const chipBase = `inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors ${focusRing}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
  return json;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function stepIndex(step: Step) {
  return step === "skipped" ? -1 : ORDER.indexOf(step);
}

function stepFromProfile(profile: RadarProfile): Step {
  switch (profile.onboardingStep) {
    case "round1":
      return "round1";
    case "round2":
      return "round2";
    case "done":
      return "done";
    case "skipped":
      return "skipped";
    default:
      return "intro";
  }
}

/* ───────────────────────── piezas de la conversación ───────────────────────── */

function Enter({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function ProfitSays({ speaker, children }: { speaker: string; children: ReactNode }) {
  return (
    <Enter className="flex flex-col gap-1.5">
      <span className="pl-1 text-[12px] font-semibold text-[#8a8177]">{speaker}</span>
      <div className="rounded-[18px] rounded-tl-[6px] border border-[#ece7e0] bg-white px-4 py-4 text-[15px] leading-[1.6] text-[#1c1917] shadow-[0_1px_2px_rgb(28_25_23/0.04)] sm:px-5">
        {children}
      </div>
    </Enter>
  );
}

function YouSay({ children }: { children: ReactNode }) {
  return (
    <Enter className="flex justify-end">
      <p className="max-w-[80%] rounded-[18px] rounded-tr-[6px] bg-[#17150f] px-4 py-2.5 text-[14px] leading-[1.5] text-white [overflow-wrap:anywhere]">
        {children}
      </p>
    </Enter>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center gap-2.5">{children}</div>;
}

function SkeletonGrid() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="aspect-[9/16] animate-pulse rounded-[14px] bg-[#f0ece6] motion-reduce:animate-none" />
      ))}
    </div>
  );
}

/* ───────────────────────────────── página ───────────────────────────────── */

export function RadarPageClient({ clienteName }: { clienteName: string }) {
  const t = useTranslations("profit.radar");
  const tCategory = useTranslations("profit.radar.categories");
  const tTags = useTranslations("profit.radar.tags");
  const categoryLabel = (c: RadarCategory) => tCategory(c);
  const reduceMotion = useReducedMotion();

  const [profile, setProfile] = useState<RadarProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("intro");

  const [category, setCategory] = useState<RadarCategory | null>(null);
  const [products, setProducts] = useState<string[]>([]);
  const [productDraft, setProductDraft] = useState("");
  const [appear, setAppear] = useState<RadarAppearance[]>([]);
  const [objective, setObjective] = useState<RadarObjective | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);

  const [round1, setRound1] = useState<RoundPayload | null>(null);
  const [round1Loading, setRound1Loading] = useState(false);
  const [reactions, setReactions] = useState<Record<string, Exclude<CardReaction, null>>>({});
  const [visibleGroups, setVisibleGroups] = useState(1);
  const [round1Summary, setRound1Summary] = useState<{ liked: number; disliked: number } | null>(null);

  const [round2, setRound2] = useState<RoundPayload | null>(null);
  const [round2Loading, setRound2Loading] = useState(false);
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [pickedCount, setPickedCount] = useState<number | null>(null);
  /* Firmas de los videos elegidos: la receta los usa como referencia (nada se guarda). */
  const [pickTokens, setPickTokens] = useState<string[]>([]);

  const [latestRecipe, setLatestRecipe] = useState<StoredRecipe | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState<string | null>(null);
  /* Precio, qué lo hace distinto, oferta: solo para esta receta. */
  const [recipeDetails, setRecipeDetails] = useState("");
  const [recipeLength, setRecipeLength] = useState<"short" | "medium" | "long">("long");

  const endRef = useRef<HTMLDivElement>(null);
  const acted = useRef(false);
  /* Videos ya mostrados en esta sesión, para que la ronda 2 no los repita. */
  const seenIds = useRef<Set<string>>(new Set());

  const seed = profile?.seed ?? null;
  const suggested = seed?.categoryName ?? null;
  const current = stepIndex(step);
  const passed = (s: Step) => current > ORDER.indexOf(s);
  const reached = (s: Step) => current >= ORDER.indexOf(s);

  /* Las rondas se piden desde las acciones (y al volver a mitad del arranque). */
  const loadRound = useCallback(
    async (n: 1 | 2) => {
      const setLoading = n === 1 ? setRound1Loading : setRound2Loading;
      setLoading(true);
      setActionError(null);
      try {
        const exclude = n === 2 ? [...seenIds.current].join(",") : "";
        const data = await api<RoundPayload>(
          `/api/profit/radar/round?n=${n}${exclude ? `&exclude=${exclude}` : ""}`,
        );
        for (const v of [...data.videos, ...data.reserves]) seenIds.current.add(v.videoId);
        if (n === 1) {
          setRound1(data);
          setReactions({});
          setVisibleGroups(1);
        } else {
          setRound2(data);
          setPicks(new Set());
        }
      } catch {
        setActionError(t("errors.load"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  const applyProfile = useCallback(
    (p: RadarProfile) => {
      setProfile(p);
      setCategory(p.categoryName ?? p.seed?.categoryName ?? null);
      setProducts(p.products.length > 0 ? p.products : (p.seed?.products ?? []));
      setAppear(p.canAppear);
      setObjective(p.objective ?? p.seed?.objective ?? null);
      setConsent(p.onboardingStep === "pending" || p.onboardingStep === "categories" ? null : p.consentRadar);
      const next = stepFromProfile(p);
      setStep(next);
      if (next === "round1") void loadRound(1);
      if (next === "round2") void loadRound(2);
    },
    [loadRound],
  );

  /* Carga inicial */
  useEffect(() => {
    let cancelled = false;
    api<{ profile: RadarProfile; latestRecipe: StoredRecipe | null }>("/api/profit/radar")
      .then((data) => {
        if (cancelled) return;
        applyProfile(data.profile);
        setLatestRecipe(data.latestRecipe ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t("errors.load"));
      });
    return () => {
      cancelled = true;
    };
  }, [applyProfile, t]);

  function retryLoad() {
    setLoadError(null);
    api<{ profile: RadarProfile }>("/api/profit/radar")
      .then((data) => applyProfile(data.profile))
      .catch(() => setLoadError(t("errors.load")));
  }

  const go = (next: Step) => {
    acted.current = true;
    setActionError(null);
    setStep(next);
  };

  /* ── acciones ── */

  async function saveProfileAndStart(accept: boolean) {
    if (!category) return;
    setConsent(accept);
    setBusy(true);
    acted.current = true;
    try {
      const data = await api<{ profile: RadarProfile }>("/api/profit/radar/profile", {
        method: "POST",
        body: JSON.stringify({
          categoryName: category,
          products,
          canAppear: appear,
          objective,
          consentRadar: accept,
          restart: true,
        }),
      });
      setProfile(data.profile);
      setRound1(null);
      setRound2(null);
      setRound1Summary(null);
      setPickedCount(null);
      setStep("round1");
      void loadRound(1);
    } catch (error) {
      setConsent(null);
      setActionError(error instanceof Error ? error.message : t("errors.save"));
    } finally {
      setBusy(false);
    }
  }

  async function finishRound1() {
    if (!round1) return;
    const tokenById = new Map([...round1.videos, ...round1.reserves].map((v) => [v.videoId, v.token]));
    const list = Object.entries(reactions)
      .map(([videoId, reaction]) => ({ token: tokenById.get(videoId), reaction }))
      .filter((r): r is { token: string; reaction: Exclude<CardReaction, null> } => Boolean(r.token));
    setBusy(true);
    acted.current = true;
    try {
      const data = await api<{ profile: RadarProfile }>("/api/profit/radar/reactions", {
        method: "POST",
        body: JSON.stringify({ round: 1, reactions: list }),
      });
      setProfile(data.profile);
      setRound1Summary({
        liked: list.filter((r) => r.reaction === "like").length,
        disliked: list.filter((r) => r.reaction === "dislike").length,
      });
      setRound2(null);
      setStep("round2");
      void loadRound(2);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("errors.save"));
    } finally {
      setBusy(false);
    }
  }

  async function finishRound2() {
    if (picks.size === 0 || !round2) return;
    const tokenById = new Map([...round2.videos, ...round2.reserves].map((v) => [v.videoId, v.token]));
    const tokens = [...picks].map((id) => tokenById.get(id)).filter((t): t is string => Boolean(t));
    setBusy(true);
    acted.current = true;
    try {
      const data = await api<{ profile: RadarProfile }>("/api/profit/radar/reactions", {
        method: "POST",
        body: JSON.stringify({
          round: 2,
          reactions: tokens.map((token) => ({ token, reaction: "pick" })),
        }),
      });
      setProfile(data.profile);
      setPickTokens(tokens);
      setPickedCount(picks.size);
      setStep("done");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("errors.save"));
    } finally {
      setBusy(false);
    }
  }

  async function buildRecipe() {
    setRecipeLoading(true);
    setActionError(null);
    acted.current = true;
    try {
      const data = await api<{ recipe: StoredRecipe }>("/api/profit/radar/recipe", {
        method: "POST",
        body: JSON.stringify({
          product: recipeProduct ?? products[0] ?? null,
          picks: pickTokens,
          details: recipeDetails.trim() || null,
          length: recipeLength,
        }),
      });
      setLatestRecipe(data.recipe);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("errors.save"));
    } finally {
      setRecipeLoading(false);
    }
  }

  async function skip() {
    setBusy(true);
    try {
      const data = await api<{ profile: RadarProfile }>("/api/profit/radar/profile", {
        method: "POST",
        body: JSON.stringify({ skip: true }),
      });
      setProfile(data.profile);
      setStep("skipped");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("errors.save"));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setRound1(null);
    setRound2(null);
    setRound1Summary(null);
    setPickedCount(null);
    setReactions({});
    setPicks(new Set());
    setConsent(null);
    go("intro");
  }

  function react(videoId: string, reaction: Exclude<CardReaction, null>) {
    acted.current = true;
    setReactions((prev) => {
      const next = { ...prev };
      if (next[videoId] === reaction) delete next[videoId];
      else next[videoId] = reaction;
      return next;
    });
  }

  /* Un video que dejó de existir se reemplaza con una reserva, sin avisar. */
  async function replaceDead(round: 1 | 2, videoId: string) {
    const payload = round === 1 ? round1 : round2;
    if (!payload) return;
    const token = payload.videos.find((v) => v.videoId === videoId)?.token;
    const result = await api<{ dead: boolean }>("/api/profit/radar/video-dead", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).catch(() => ({ dead: false }));
    if (!result.dead) return;
    const setter = round === 1 ? setRound1 : setRound2;
    setter((prev) => {
      if (!prev) return prev;
      const [replacement, ...reserves] = prev.reserves;
      const videos = replacement
        ? prev.videos.map((v) => (v.videoId === videoId ? replacement : v))
        : prev.videos.filter((v) => v.videoId !== videoId);
      return { ...prev, videos, reserves };
    });
  }

  function addProduct() {
    const name = productDraft.trim().slice(0, 80);
    if (!name || products.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setProductDraft("");
      return;
    }
    setProducts((prev) => [...prev, name].slice(0, 12));
    setProductDraft("");
  }

  /* ── derivados ── */

  const groups1 = useMemo(() => chunks(round1?.videos ?? [], GROUP), [round1]);
  const reactedCount = Object.keys(reactions).length;
  const round1Total = round1?.videos.length ?? 0;
  const round1Min = Math.min(MIN_ROUND1, round1Total);
  // Al marcar todos los visibles aparece el siguiente grupo (o antes, con "Ver tres más").
  let shownGroups = Math.min(visibleGroups, groups1.length);
  while (
    shownGroups < groups1.length &&
    groups1.slice(0, shownGroups).flat().every((v) => reactions[v.videoId])
  ) {
    shownGroups += 1;
  }
  const allShownReacted = groups1.slice(0, shownGroups).flat().every((v) => reactions[v.videoId]);

  /* Seguir la conversación: solo después de que el cliente actúa. */
  useEffect(() => {
    if (!acted.current) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduceMotion ? "auto" : "smooth" });
  }, [step, shownGroups, round1, round2, round1Summary, pickedCount, recipeLoading, latestRecipe, reduceMotion]);


  const learned = useMemo(
    () => (profile ? topPreferences(profile.taste, 1).slice(0, 4) : []),
    [profile],
  );

  const appearLabel = (a: RadarAppearance) => t(`appear.${a}`);
  const objectiveLabel = (o: RadarObjective) => t(`objective.${o}`);
  const tagLabel = (dimension: string, value: string) =>
    tTags.has(`${dimension}.${value}` as Parameters<typeof tTags>[0])
      ? tTags(`${dimension}.${value}` as Parameters<typeof tTags>[0])
      : value;

  const introText = seed?.summary
    ? t("intro.withSummary", { summary: seed.summary })
    : seed && seed.products.length > 0
      ? t("intro.withProducts", { products: seed.products.slice(0, 3).join(", ") })
      : t("intro.plain");

  /* Chips de la línea "Tu perfil": solo lo ya respondido. */
  const profileChips: Array<{ key: string; label: string; learned?: boolean }> = [];
  if (passed("intro") && category) profileChips.push({ key: "cat", label: categoryLabel(category) });
  if (passed("products") && products.length > 0) {
    const shown = products.slice(0, 2).join(" · ");
    profileChips.push({ key: "prod", label: products.length > 2 ? `${shown} +${products.length - 2}` : shown });
  }
  if (passed("appear")) for (const a of appear) profileChips.push({ key: `ap-${a}`, label: appearLabel(a) });
  if (passed("objective") && objective) profileChips.push({ key: "obj", label: objectiveLabel(objective) });
  if (passed("round1"))
    for (const p of learned)
      profileChips.push({ key: `l-${p.dimension}`, label: tagLabel(p.dimension, p.value), learned: true });

  const onboarding = step !== "done" && step !== "skipped";

  /* ───────────────────────────── render ───────────────────────────── */

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <RadarHeader t={t} clienteName={clienteName} />
        <div className="mx-auto w-full max-w-[760px]">
          {loadError ? (
            <div role="alert" className="rounded-[14px] border border-[#ece7e0] bg-white px-5 py-4 text-[14px] text-[#1c1917]">
              <p>{loadError}</p>
              <button type="button" onClick={retryLoad} className={`${secondaryBase} mt-3 h-10 px-5`}>
                {t("errors.retry")}
              </button>
            </div>
          ) : (
            <div className="h-40 animate-pulse rounded-[18px] bg-[#f0ece6] motion-reduce:animate-none" aria-busy />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 selection:bg-[#ffd8bf] selection:text-[#1c1917]">
      <RadarHeader
        t={t}
        clienteName={clienteName}
        trailing={
          onboarding ? (
            <button
              type="button"
              onClick={() => void skip()}
              disabled={busy}
              className={`rounded-lg px-2 py-1 text-[13px] font-semibold text-[#5c564e] underline-offset-[3px] hover:text-[#1c1917] hover:underline disabled:opacity-40 ${focusRing}`}
            >
              {t("skip")}
            </button>
          ) : null
        }
      />

      {/* Tu perfil: cada respuesta entra aquí como un chip. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] z-10 mx-auto w-full max-w-[760px] sm:top-[calc(4rem+env(safe-area-inset-top)+0.5rem)]">
        <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-[14px] border border-[#ece7e0] bg-white/95 px-4 py-2.5 shadow-[0_8px_24px_-18px_rgb(28_25_23/0.35)] backdrop-blur-sm">
          <span className="mr-1 text-[12.5px] font-semibold text-[#1c1917]">{t("profileLine")}</span>
          {profileChips.length === 0 ? (
            <span className="text-[13px] text-[#8a8177]">{t("profileEmpty")}</span>
          ) : null}
          <AnimatePresence initial={false}>
            {profileChips.map((chip) => (
              <motion.span
                key={chip.key}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.86, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                className={`inline-flex h-7 min-w-0 max-w-full items-center rounded-full px-3 text-[13px] font-medium ${
                  chip.learned ? "bg-[#fff1e8] text-[#9a3412]" : "bg-[#f5f2ed] text-[#1c1917]"
                }`}
              >
                <span className="truncate">{chip.label}</span>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 pb-28">
        {step === "skipped" ? (
          <ProfitSays speaker={t("speaker.profit")}>
            <p>{t("skipped.message")}</p>
            <Actions>
              <button type="button" className={primaryBtn} onClick={() => go("intro")}>
                {t("skipped.start")}
              </button>
            </Actions>
          </ProfitSays>
        ) : null}

        {/* 1 · Rubro */}
        {reached("intro") ? (
          <ProfitSays speaker={t("speaker.profit")}>
            <p className="max-w-[62ch]">{introText}</p>
            {!passed("intro") ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t("intro.choose")}>
                  {RADAR_CATEGORIES.map((c) => {
                    const selected = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setCategory(c)}
                        className={`${chipBase} ${
                          selected
                            ? "border-[#17150f] bg-[#17150f] text-white"
                            : "border-[#e0d9d0] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
                        }`}
                      >
                        {categoryLabel(c)}
                        {suggested === c ? (
                          <span className={`text-[11px] font-semibold ${selected ? "text-white/70" : "text-[#8a8177]"}`}>
                            · {t("intro.suggested")}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <Actions>
                  <button type="button" className={primaryBtn} disabled={!category} onClick={() => go("products")}>
                    {category && category === suggested ? t("intro.confirm") : t("products.continue")}
                  </button>
                </Actions>
              </>
            ) : null}
          </ProfitSays>
        ) : null}
        {passed("intro") && category ? <YouSay>{categoryLabel(category)}</YouSay> : null}

        {/* 2 · Productos */}
        {reached("products") ? (
          <ProfitSays speaker={t("speaker.profit")}>
            <p>{t("products.ask")}</p>
            {!passed("products") ? (
              <>
                {products.length > 0 ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {products.map((name) => (
                      <li key={name} className="min-w-0 max-w-full">
                        <span className="inline-flex h-9 max-w-full items-center gap-1 rounded-full bg-[#f5f2ed] pl-3.5 pr-1.5 text-[13.5px] font-medium">
                          <span className="min-w-0 truncate" title={name}>{name}</span>
                          <button
                            type="button"
                            aria-label={t("products.remove", { name })}
                            onClick={() => setProducts((prev) => prev.filter((p) => p !== name))}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8a8177] hover:bg-[#ebe5dd] hover:text-[#1c1917] ${focusRing}`}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                              <path d="M6 6l12 12M18 6 6 18" />
                            </svg>
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <form
                  className="mt-3 flex max-w-md gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addProduct();
                  }}
                >
                  <label htmlFor="radar-product" className="sr-only">
                    {t("products.placeholder")}
                  </label>
                  <input
                    id="radar-product"
                    value={productDraft}
                    onChange={(e) => setProductDraft(e.target.value)}
                    placeholder={t("products.placeholder")}
                    maxLength={80}
                    className="h-10 min-w-0 flex-1 rounded-[10px] border border-[#e0d9d0] bg-white px-3 text-[14px] text-[#1c1917] caret-[#ff781f] placeholder:text-[#8a8177] hover:border-[#cfc6bb] focus:border-[#1c1917] focus:outline-none"
                  />
                  <button type="submit" className={`${secondaryBase} h-10 shrink-0 px-4`} disabled={!productDraft.trim()}>
                    {t("products.add")}
                  </button>
                </form>
                <Actions>
                  <button type="button" className={primaryBtn} onClick={() => go("appear")}>
                    {products.length > 0 ? t("products.continue") : t("products.none")}
                  </button>
                </Actions>
              </>
            ) : null}
          </ProfitSays>
        ) : null}
        {passed("products") ? (
          <YouSay>{products.length > 0 ? products.join(", ") : t("products.answerNone")}</YouSay>
        ) : null}

        {/* 3 · Quién sale en cámara */}
        {reached("appear") ? (
          <ProfitSays speaker={t("speaker.profit")}>
            <p>{t("appear.ask")}</p>
            {!passed("appear") ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("appear.ask")}>
                  {RADAR_APPEARANCE.map((a) => {
                    const on = appear.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setAppear((prev) => (on ? prev.filter((x) => x !== a) : [...prev, a]))
                        }
                        className={`${chipBase} ${
                          on
                            ? "border-[#17150f] bg-[#17150f] text-white"
                            : "border-[#e0d9d0] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
                        }`}
                      >
                        {appearLabel(a)}
                      </button>
                    );
                  })}
                </div>
                <Actions>
                  <button type="button" className={primaryBtn} disabled={appear.length === 0} onClick={() => go("objective")}>
                    {t("appear.continue")}
                  </button>
                </Actions>
              </>
            ) : null}
          </ProfitSays>
        ) : null}
        {passed("appear") ? <YouSay>{appear.map(appearLabel).join(", ")}</YouSay> : null}

        {/* 4 · Objetivo */}
        {reached("objective") ? (
          <ProfitSays speaker={t("speaker.profit")}>
            <p>{t("objective.ask")}</p>
            {!passed("objective") ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {RADAR_OBJECTIVES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      setObjective(o);
                      go("consent");
                    }}
                    className={`${chipBase} ${
                      objective === o && seed?.objective === o
                        ? "border-[#1c1917] bg-white text-[#1c1917]"
                        : "border-[#e0d9d0] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
                    }`}
                  >
                    {objectiveLabel(o)}
                  </button>
                ))}
              </div>
            ) : null}
          </ProfitSays>
        ) : null}
        {passed("objective") && objective ? <YouSay>{objectiveLabel(objective)}</YouSay> : null}

        {/* 5 · Consentimiento */}
        {reached("consent") ? (
          <ProfitSays speaker={t("speaker.profit")}>
            <p className="max-w-[62ch]">{t("consent.ask")}</p>
            {!passed("consent") ? (
              <Actions>
                <button type="button" className={primaryBtn} disabled={busy} onClick={() => void saveProfileAndStart(true)}>
                  {t("consent.accept")}
                </button>
                <button type="button" className={secondaryBtn} disabled={busy} onClick={() => void saveProfileAndStart(false)}>
                  {t("consent.decline")}
                </button>
              </Actions>
            ) : null}
          </ProfitSays>
        ) : null}
        {passed("consent") && consent !== null ? (
          <YouSay>{consent ? t("consent.answerYes") : t("consent.answerNo")}</YouSay>
        ) : null}

        {/* 6 · Ronda amplia */}
        {reached("round1") && !passed("round1") ? (
          <>
            {round1Loading || !round1 ? (
              <ProfitSays speaker={t("speaker.profit")}>
                <p>{category ? t("round1.intro", { category: categoryLabel(category) }) : null}</p>
                <p aria-live="polite" className="mt-2 text-[13.5px] text-[#5c564e]">{t("searching")}</p>
                <SkeletonGrid />
              </ProfitSays>
            ) : round1.videos.length === 0 ? (
              <ProfitSays speaker={t("speaker.profit")}>
                <p>{t("emptyPool")}</p>
              </ProfitSays>
            ) : (
              groups1.slice(0, shownGroups).map((group, index) => (
                <ProfitSays key={index} speaker={t("speaker.profit")}>
                  {index === 0 ? (
                    <>
                      <p className="max-w-[62ch]">{t("round1.intro", { category: category ? categoryLabel(category) : "" })}</p>
                      {round1.regionFallback ? <p className="mt-2 text-[13.5px] text-[#5c564e]">{t("region")}</p> : null}
                    </>
                  ) : (
                    <p>{t("round1.more")}</p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {group.map((video) => (
                      <RadarVideoCard
                        key={video.videoId}
                        video={video}
                        mode="react"
                        reaction={reactions[video.videoId] ?? null}
                        onReact={(r) => react(video.videoId, r)}
                        onDead={() => void replaceDead(1, video.videoId)}
                      />
                    ))}
                  </div>
                  {index === shownGroups - 1 ? (
                    <Round1Footer
                      t={t}
                      done={reactedCount}
                      total={round1Total}
                      min={round1Min}
                      busy={busy}
                      canShowMore={shownGroups < groups1.length && !allShownReacted}
                      onShowMore={() => {
                        acted.current = true;
                        setVisibleGroups(shownGroups + 1);
                      }}
                      onFinish={() => void finishRound1()}
                    />
                  ) : null}
                </ProfitSays>
              ))
            )}
          </>
        ) : null}
        {passed("round1") ? (
          <>
            {round1Summary ? (
              <YouSay>{t("round1.answer", { liked: round1Summary.liked, disliked: round1Summary.disliked })}</YouSay>
            ) : null}
            <ProfitSays speaker={t("speaker.profit")}>
              {learned.length > 0 ? (
                <>
                  <p>{t("learned.intro")}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {learned.map((p) => (
                      <li key={p.dimension} className="inline-flex h-8 items-center rounded-full bg-[#fff1e8] px-3 text-[13.5px] font-medium text-[#9a3412]">
                        {tagLabel(p.dimension, p.value)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>{t("learned.none")}</p>
              )}
            </ProfitSays>
          </>
        ) : null}

        {/* 7 · Ronda reducida */}
        {reached("round2") && !passed("round2") ? (
          <ProfitSays speaker={t("speaker.profit")}>
            <p className="max-w-[62ch]">{t("round2.intro")}</p>
            {round2Loading || !round2 ? (
              <>
                <p aria-live="polite" className="mt-2 text-[13.5px] text-[#5c564e]">{t("searching")}</p>
                <SkeletonGrid />
              </>
            ) : round2.videos.length === 0 ? (
              <p className="mt-3 text-[14px] text-[#5c564e]">{t("emptyPool")}</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {round2.videos.map((video: RoundVideo) => (
                    <RadarVideoCard
                      key={video.videoId}
                      video={video}
                      mode="pick"
                      picked={picks.has(video.videoId)}
                      onTogglePick={() =>
                        setPicks((prev) => {
                          const next = new Set(prev);
                          if (next.has(video.videoId)) next.delete(video.videoId);
                          else next.add(video.videoId);
                          return next;
                        })
                      }
                      onDead={() => void replaceDead(2, video.videoId)}
                    />
                  ))}
                </div>
                <Actions>
                  <button type="button" className={primaryBtn} disabled={busy || picks.size === 0} onClick={() => void finishRound2()}>
                    {t("round2.submit")}
                  </button>
                  <span className="text-[13.5px] tabular-nums text-[#5c564e]" aria-live="polite">
                    {t("round2.count", { count: picks.size })}
                  </span>
                </Actions>
              </>
            )}
          </ProfitSays>
        ) : null}

        {/* 8 · Listo */}
        {step === "done" ? (
          <>
            {pickedCount ? <YouSay>{t("round2.answer", { count: pickedCount })}</YouSay> : null}
            <ProfitSays speaker={t("speaker.profit")}>
              <p className="max-w-[62ch]">{t("done.message")}</p>
              {products.length > 1 ? (
                <>
                  <p className="mt-3 text-[14px] text-[#5c564e]">{t("recipe.ask")}</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("recipe.ask")}>
                    {products.map((name) => {
                      const selected = (recipeProduct ?? products[0]) === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setRecipeProduct(name)}
                          className={`${chipBase} max-w-full ${
                            selected
                              ? "border-[#17150f] bg-[#17150f] text-white"
                              : "border-[#e0d9d0] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
                          }`}
                        >
                          <span className="truncate">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
              <p className="mt-4 text-[14px] text-[#5c564e]">{t("recipe.lengthAsk")}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("recipe.lengthAsk")}>
                {(["short", "medium", "long"] as const).map((value) => {
                  const selected = recipeLength === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRecipeLength(value)}
                      className={`${chipBase} ${
                        selected
                          ? "border-[#17150f] bg-[#17150f] text-white"
                          : "border-[#e0d9d0] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
                      }`}
                    >
                      {t(`recipe.length.${value}`)}
                    </button>
                  );
                })}
              </div>
              <label className="mt-4 block max-w-[62ch]">
                <span className="text-[14px] text-[#5c564e]">{t("recipe.detailsLabel")}</span>
                <textarea
                  value={recipeDetails}
                  onChange={(e) => setRecipeDetails(e.target.value.slice(0, 600))}
                  rows={3}
                  placeholder={t("recipe.detailsPlaceholder")}
                  className="mt-2 block w-full resize-y rounded-[12px] border border-[#e0d9d0] bg-white px-3.5 py-2.5 text-[14px] leading-[1.5] text-[#1c1917] placeholder:text-[#a79e95] focus-visible:border-[#cfc6bb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/50"
                />
              </label>
              <Actions>
                <button type="button" className={primaryBtn} disabled={recipeLoading} onClick={() => void buildRecipe()}>
                  {latestRecipe ? t("recipe.again") : t("recipe.generate")}
                </button>
                <button type="button" className={secondaryBtn} disabled={recipeLoading} onClick={restart}>
                  {t("done.redo")}
                </button>
              </Actions>
            </ProfitSays>
            {recipeLoading ? (
              <ProfitSays speaker={t("speaker.profit")}>
                <p aria-live="polite">{t("recipe.generating")}</p>
                <div className="mt-4 flex flex-col gap-2.5" aria-hidden>
                  {[92, 78, 85, 60].map((w) => (
                    <div
                      key={w}
                      className="h-3 animate-pulse rounded-full bg-[#f0ece6] motion-reduce:animate-none"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </ProfitSays>
            ) : latestRecipe ? (
              <Enter className="flex flex-col gap-1.5">
                <span className="pl-1 text-[12px] font-semibold text-[#8a8177]">{t("speaker.profit")}</span>
                <RadarRecipeView stored={latestRecipe} />
              </Enter>
            ) : null}
          </>
        ) : null}

        {actionError ? (
          <div role="alert" className="rounded-[12px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[14px] text-[#991b1b]">
            {actionError}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}

/* ───────────────────────────── subcomponentes ───────────────────────────── */

type RadarT = ReturnType<typeof useTranslations<"profit.radar">>;

function RadarHeader({ t, clienteName, trailing }: { t: RadarT; clienteName: string; trailing?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-1 pt-1">
      <div className="min-w-0">
        <h1 className="text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-[#1c1917] sm:text-[1.75rem]">
          {t("title")}
          <span className="font-semibold text-[#8a8177]"> · {clienteName}</span>
        </h1>
        <p className="mt-1.5 max-w-xl text-[14px] leading-[1.55] text-[#5c564e]">{t("subtitle")}</p>
      </div>
      <div className="flex items-center gap-3">
        {trailing}
        <ProfitSectionSwitch active="radar" />
      </div>
    </header>
  );
}

function Round1Footer({
  t,
  done,
  total,
  min,
  busy,
  canShowMore,
  onShowMore,
  onFinish,
}: {
  t: RadarT;
  done: number;
  total: number;
  min: number;
  busy: boolean;
  canShowMore: boolean;
  onShowMore: () => void;
  onFinish: () => void;
}) {
  const ready = done >= min && total > 0;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[#ece7e0] pt-4">
      <div className="flex min-w-[180px] flex-1 items-center gap-3">
        <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-[#f0ece6]" aria-hidden>
          <div
            className="h-full rounded-full bg-[#ff781f] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${total > 0 ? Math.min(100, (done / total) * 100) : 0}%` }}
          />
        </div>
        <span className="text-[13px] tabular-nums text-[#5c564e]" aria-live="polite">
          {t("round1.progress", { done, total })}
        </span>
      </div>
      {canShowMore ? (
        <button type="button" className={`${secondaryBase} h-10 px-5`} onClick={onShowMore}>
          {t("round1.showMore")}
        </button>
      ) : null}
      <button type="button" className={`${primaryBase} h-10 px-5`} disabled={!ready || busy} onClick={onFinish}>
        {t("round1.finish")}
      </button>
      {!ready && total > 0 ? (
        <span className="w-full text-[12.5px] text-[#8a8177]">{t("round1.needMore", { min })}</span>
      ) : null}
    </div>
  );
}
