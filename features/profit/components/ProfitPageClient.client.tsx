"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { ProfitDateRangeField } from "@/features/profit/components/ProfitDateRangeField.client";
import { ProfitSectionSwitch } from "@/features/profit/radar/components/ProfitSectionSwitch";
import { RadarInviteCard } from "@/features/profit/radar/components/RadarInviteCard";
import {
  RealProfitConnect,
  type RpConnections,
} from "@/features/profit/components/RealProfitConnect.client";
import { formatMoney } from "@/lib/format-money";
import { moneyUsd } from "@/lib/format/money-usd";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import type { ClienteScore } from "@/lib/realprofit/client-score";

const ProfitAdvisorBot = dynamic(
  () =>
    import("@/features/profit/components/ProfitAdvisorBot.client").then(
      (m) => m.ProfitAdvisorBot,
    ),
  { ssr: false, loading: () => <ProfitAdvisorBotFallback /> },
);

const ProductPerformancePanel = dynamic(
  () =>
    import("@/features/profit/components/ProductPerformancePanel.client").then(
      (m) => m.ProductPerformancePanel,
    ),
  // Vacío si no hay productos: un esqueleto aparecería y se iría.
  { ssr: false, loading: () => null },
);

const ProfitPilotPanel = dynamic(
  () => import("@/features/profit/components/ProfitPilotPanel.client").then((m) => m.ProfitPilotPanel),
  { ssr: false, loading: () => null },
);

const ProfitAdsTable = dynamic(
  () => import("@/features/profit/components/ProfitAdsTable.client").then((m) => m.ProfitAdsTable),
  { ssr: false, loading: () => null },
);

function ProfitAdvisorBotFallback() {
  const t = useTranslations("profit");
  return (
    <section
      id="profit-advisor"
      aria-busy="true"
      aria-label={t("advisorTitle")}
      className="overflow-hidden rounded-[1.4rem] border border-[#eadfd5] bg-[#fffdfb]"
    >
      <header className="flex items-center gap-4 border-b border-[#eee3da] px-6 py-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1c1917]">
          <span className="text-[11px] font-black tracking-tight text-[#ff8a45]">
            AI
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#cf5a20]">
            {t("advisorEyebrow")}
          </p>
          <h2 className="mt-1 text-[1.15rem] font-bold tracking-[-0.025em] text-[#1c1917]">
            {t("advisorTitle")}
          </h2>
        </div>
      </header>
      <div className="min-h-[220px] animate-pulse bg-[#fffaf6] motion-reduce:animate-none" />
      <div className="border-t border-[#eee3da] px-5 py-4 sm:px-6">
        <div className="h-12 rounded-2xl bg-[#fffaf6]" />
      </div>
    </section>
  );
}

function limaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Último día con jale Hecom (gasto ads cierra hasta ayer). */
function limaSpendMaxYmd(): string {
  const today = limaTodayYmd();
  const base = new Date(`${today}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}

type StoreSummary = {
  id: string;
  name: string;
  shopDomain: string | null;
  currency: string;
  isActive?: boolean;
};

type CampaignRow = {
  campaignExternalId: string;
  campaignName: string;
  platform: string;
  spend: number;
  spendShare: number;
  collectedEstimated: number;
  roasEstimated: number | null;
  bm: string | null;
  advertiserId: string | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  costPerConversion: number | null;
  hasTikTokPerf: boolean;
  lastStatDate: string | null;
};

type DailyPoint = { date: string; spend: number };

type ProfitSignal = {
  kind: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
};

type StaffOps = {
  walletAvailableUsd: number | null;
  adLedgerAvailableUsd: number;
  accountsWithLedgerBalance: number;
  lastAllocation: {
    accountLabel: string;
    amountUsd: number;
    hoursAgo: number;
    at: string;
  } | null;
  burn: {
    critical: number;
    warn: number;
    info: number;
    status: "critical" | "warn" | "info" | "none";
  };
  creditHint: string;
  score: ClienteScore | null;
};

type Analysis = {
  from: string;
  to: string;
  spendToday: number;
  spendYesterday: number;
  spendTodayDeltaPct: number | null;
  spend7d: number;
  spendPrev7d: number;
  spend7dDeltaPct: number | null;
  spend30d: number;
  spendInRange: number;
  spendPrevRange: number;
  spendRangeDeltaPct: number | null;
  pacingRatio: number | null;
  pacingLabel: "acelerando" | "normal" | "bajo" | "parado" | "sin_base";
  daysWithActivity: number;
  dailySeries: DailyPoint[];
  campaigns: CampaignRow[];
  collectedRevenue: number;
  roasCollected: number | null;
  hasCodLink: boolean;
  ordersCollected?: number;
  cpaCollected?: number | null;
  avgOrderCollected?: number | null;
  feePercent?: number;
  effectiveAdSpend?: number;
  roasEffective?: number | null;
  breakEvenRoas?: number;
  aboveBreakEven?: boolean | null;
  cogsTotal?: number;
  courierTotal?: number;
  netProfit?: number | null;
  hasProductCosts?: boolean;
  dataThroughDate: string | null;
  signals: ProfitSignal[];
  perf?: {
    available: boolean;
    impressions: number;
    clicks: number;
    conversions: number;
    avgCtr: number | null;
    avgCpc: number | null;
    avgCpm: number | null;
    advertisersQueried: number;
    advertisersOk: number;
    fetchedAt: string | null;
    error: string | null;
  };
};

type Snapshot = {
  store: StoreSummary;
  from: string;
  to: string;
  collectedRevenue: number;
  adSpend: number;
  roasCollected: number | null;
  ordersCollected: number;
  netProfit?: number;
  spendSource?: "realprofit" | "holistic_tiktok" | "mixed" | "none";
};

function formatDelta(pct: number | null, noBaselineLabel: string): string {
  if (pct == null) return noBaselineLabel;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function pacingBadgeClass(label: Analysis["pacingLabel"]): string {
  switch (label) {
    case "acelerando":
      return "bg-[#fff7f0] text-[#c2410c]";
    case "bajo":
      return "bg-amber-50 text-amber-900";
    case "parado":
      return "bg-[#f3efe9] text-[#6b645c]";
    case "normal":
      return "bg-emerald-50 text-emerald-800";
    default:
      return "bg-[#f3efe9] text-[#6b645c]";
  }
}

function formatSyncTime(iso: string | null, bcp47: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(bcp47, {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Campañas visibles antes de "Ver todas". */
const CAMPAIGNS_PREVIEW = 10;

type SortKey = "spend" | "share" | "name" | "roas" | "ctr" | "cpc";

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border px-3.5 py-3.5 ${
        accent
          ? "border-[#ffd7b8] bg-[#fff7f0]"
          : "border-[#ece7e0] bg-white"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9a9187]">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-[1.05rem] font-bold tabular-nums tracking-[-0.02em] sm:text-[1.25rem] ${
          accent ? "text-[#c2410c]" : "text-[#1c1917]"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 break-words text-[11px] text-[#8a8177]">{hint}</p>
    </div>
  );
}

function formatDayShort(ymd: string, bcp47: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(bcp47, {
    day: "numeric",
    month: "short",
  }).format(dt);
}

function formatRangeLabel(from: string, to: string, bcp47: string): string {
  if (!from || !to) return "—";
  if (from === to) return formatDayShort(from, bcp47);
  return `${formatDayShort(from, bcp47)} → ${formatDayShort(to, bcp47)}`;
}

/** Evita mostrar solo el ID numérico como “nombre” de campaña. */
function displayCampaignTitle(name: string, externalId: string): string {
  const id = externalId.replace(/^name:/, "").trim();
  const n = String(name ?? "").trim();
  if (!n || n === id || /^\d{10,}$/.test(n)) {
    return id ? `Campaña · …${id.slice(-6)}` : "Campaña sin nombre";
  }
  return n;
}

const SCORE_RING = 2 * Math.PI * 46;

function scoreInk(verdict: ClienteScore["verdict"] | undefined) {
  switch (verdict) {
    case "green":
      return {
        stroke: "#6ee7b7",
        glow: "bg-emerald-400/25",
        chip: "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/35",
        action: "bg-[#e7f8ef] text-[#14532d]",
      };
    case "yellow":
      return {
        stroke: "#fcd34d",
        glow: "bg-amber-300/20",
        chip: "bg-amber-300/15 text-amber-100 ring-1 ring-amber-200/35",
        action: "bg-[#fff6d8] text-[#854d0e]",
      };
    case "orange":
      return {
        stroke: "#ffb080",
        glow: "bg-[#ff781f]/30",
        chip: "bg-[#ff781f]/15 text-[#ffe0cc] ring-1 ring-[#ffb080]/40",
        action: "bg-[#fff1e6] text-[#9a3412]",
      };
    case "red":
      return {
        stroke: "#fca5a5",
        glow: "bg-red-400/25",
        chip: "bg-red-400/15 text-red-100 ring-1 ring-red-300/40",
        action: "bg-[#fee2e2] text-[#991b1b]",
      };
    default:
      return {
        stroke: "rgba(255,255,255,0.45)",
        glow: "bg-white/10",
        chip: "bg-white/10 text-white/70 ring-1 ring-white/15",
        action: "bg-white/10 text-white/70",
      };
  }
}

function useCountUp(target: number | null) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (target == null || reduce) {
      const frame = requestAnimationFrame(() => setShown(target ?? 0));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 820);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

function ScoreDial({
  value,
  verdict,
  caption,
}: {
  value: number | null;
  verdict: ClienteScore["verdict"];
  caption: string;
}) {
  const ink = scoreInk(verdict);
  const shown = useCountUp(value);
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-[128px] w-[128px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke={ink.stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={SCORE_RING}
          strokeDashoffset={SCORE_RING * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[2.05rem] font-bold leading-none tabular-nums tracking-tight"
          style={{ color: ink.stroke }}
        >
          {value == null ? "—" : shown}
        </span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
          {caption}
        </span>
      </div>
    </div>
  );
}

function FactorMeter({
  points,
  delayMs,
}: {
  points: number | null;
  delayMs: number;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(points ?? 8));
    return () => cancelAnimationFrame(frame);
  }, [points]);
  const tone =
    points == null
      ? "bg-white/25"
      : points >= 70
        ? "bg-emerald-400"
        : points >= 45
          ? "bg-amber-300"
          : "bg-red-400";
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        // La transición va en clases: un `transition` inline anulaba motion-reduce.
        className={`h-full rounded-full ${tone} transition-[width] duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
        style={{
          width: `${width}%`,
          transitionDelay: `${delayMs}ms`,
        }}
      />
    </div>
  );
}

function scoreVerdictLabel(
  verdict: ClienteScore["verdict"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (verdict) {
    case "green":
      return t("scoreVerdictGreen");
    case "yellow":
      return t("scoreVerdictYellow");
    case "orange":
      return t("scoreVerdictOrange");
    case "red":
      return t("scoreVerdictRed");
    default:
      return t("scoreVerdictNoBase");
  }
}

function scoreHint(
  verdict: ClienteScore["verdict"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (verdict) {
    case "green":
      return t("scoreHintGreen");
    case "yellow":
      return t("scoreHintYellow");
    case "orange":
      return t("scoreHintOrange");
    case "red":
      return t("scoreHintRed");
    default:
      return t("scoreHintNoBase");
  }
}

function scoreActionLabel(
  verdict: ClienteScore["verdict"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (verdict) {
    case "green":
      return t("scoreActionGreen");
    case "yellow":
      return t("scoreActionYellow");
    case "orange":
      return t("scoreActionOrange");
    case "red":
      return t("scoreActionRed");
    default:
      return t("scoreActionNoBase");
  }
}

function scoreFactorLabel(
  id: ClienteScore["factors"][number]["id"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (id) {
    case "ads":
      return t("scoreFactorAds");
    case "credit":
      return t("scoreFactorCredit");
    case "collections":
      return t("scoreFactorCollections");
    default:
      return t("scoreFactorTickets");
  }
}

function scoreNoteLabel(
  note: ClienteScore["factors"][number]["note"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (note) {
    case "ads_none":
      return t("scoreNoteAdsNone");
    case "ads_strong":
      return t("scoreNoteAdsStrong");
    case "ads_mid":
      return t("scoreNoteAdsMid");
    case "ads_weak":
      return t("scoreNoteAdsWeak");
    case "credit_ok":
      return t("scoreNoteCreditOk");
    case "credit_watch":
      return t("scoreNoteCreditWatch");
    case "credit_burn_fast":
      return t("scoreNoteCreditBurnFast");
    case "credit_risk":
      return t("scoreNoteCreditRisk");
    case "credit_agency":
      return t("scoreNoteCreditAgency");
    case "collections_unknown":
      return t("scoreNoteCollectionsUnknown");
    case "collections_none":
      return t("scoreNoteCollectionsNone");
    case "collections_clean":
      return t("scoreNoteCollectionsClean");
    case "collections_one":
      return t("scoreNoteCollectionsOne");
    case "collections_many":
      return t("scoreNoteCollectionsMany");
    case "tickets_unknown":
      return t("scoreNoteTicketsUnknown");
    case "tickets_clear":
      return t("scoreNoteTicketsClear");
    default:
      return t("scoreNoteTicketsOpen");
  }
}

function StaffOpsPanel({
  ops,
  spendTodayUsd,
  spend7dUsd,
  pacingLabel,
  pacingRatio,
  fromLiveFallback,
  t,
}: {
  ops: StaffOps;
  spendTodayUsd: number;
  spend7dUsd: number;
  pacingLabel: string;
  pacingRatio: number | null;
  fromLiveFallback: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const score = ops.score;
  const ink = scoreInk(score?.verdict);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#ff781f]/40 bg-[#1c1917] p-5 text-white shadow-[0_18px_50px_-22px_rgb(28_25_23_/_0.7)] sm:p-6">
      <div
        aria-hidden
        className={`pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full blur-3xl ${ink.glow}`}
      />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {score ? (
            <ScoreDial
              value={score.score}
              verdict={score.verdict}
              caption={t("scoreDialLabel")}
            />
          ) : (
            <div className="grid h-[128px] w-[128px] shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-[13px] text-white/50">
              …
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#ffb080]">
              {t("staffOpsLabel")}
            </p>
            <h2 className="mt-1 text-[1.2rem] font-bold tracking-tight">
              {t("scoreTitle")}
            </h2>
            <p className="mt-1 max-w-lg text-[12.5px] leading-5 text-white/55">
              {t("scoreSubtitle")}
            </p>
            {score ? (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["green", "scoreBandGreen"],
                      ["yellow", "scoreBandYellow"],
                      ["orange", "scoreBandOrange"],
                      ["red", "scoreBandRed"],
                    ] as const
                  ).map(([band, rangeKey]) => {
                    const active = score.verdict === band;
                    const bandInk = scoreInk(band);
                    return (
                      <span
                        key={band}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                          active
                            ? bandInk.chip
                            : "bg-white/5 text-white/35 ring-1 ring-white/10"
                        }`}
                      >
                        {scoreVerdictLabel(band, t)} {t(rangeKey)}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 max-w-lg text-[14px] leading-5 text-white/80">
                  {scoreHint(score.verdict, t)}
                </p>
                <p
                  className={`mt-3 inline-flex rounded-lg px-3 py-1.5 text-[13px] font-semibold ${ink.action} ${
                    score.verdict === "red"
                      ? "animate-pulse motion-reduce:animate-none"
                      : ""
                  }`}
                >
                  {scoreActionLabel(score.verdict, t)}
                </p>
                <a
                  href="#profit-advisor"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ff781f] px-3.5 py-2 text-[12px] font-bold text-[#1c1917] transition hover:brightness-110"
                >
                  <span
                    aria-hidden
                    className="grid h-5 w-5 place-items-center rounded-full bg-[#1c1917] text-[9px] font-black text-[#ff781f]"
                  >
                    AI
                  </span>
                  {t("advisorOpen")}
                </a>
              </>
            ) : (
              <>
                <p className="mt-2 text-[13px] text-white/70">{t("scorePending")}</p>
                <a
                  href="#profit-advisor"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ff781f] px-3.5 py-2 text-[12px] font-bold text-[#1c1917] transition hover:brightness-110"
                >
                  <span
                    aria-hidden
                    className="grid h-5 w-5 place-items-center rounded-full bg-[#1c1917] text-[9px] font-black text-[#ff781f]"
                  >
                    AI
                  </span>
                  {t("advisorOpen")}
                </a>
              </>
            )}
          </div>
        </div>

        {score ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {score.factors.map((factor, index) => (
              <div
                key={factor.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">
                    {scoreFactorLabel(factor.id, t)}
                  </p>
                  <p className="text-[13px] font-semibold tabular-nums">
                    {factor.points ?? "—"}
                  </p>
                </div>
                <FactorMeter points={factor.points} delayMs={index * 90} />
                <p className="mt-1.5 text-[12px] leading-4 text-white/65">
                  {scoreNoteLabel(factor.note, t)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white/40">
            {t("staffOpsTitle")}
          </p>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-white/75">
            {ops.creditHint}
          </p>
          {fromLiveFallback ? (
            <p className="mt-1 text-[11px] font-medium text-[#ffb080]">
              {t("staffOpsLiveFallback")}
            </p>
          ) : null}
        </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white/10 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">
            {t("staffOpsWallet")}
          </p>
          <p className="mt-1 text-[1.05rem] font-semibold tabular-nums">
            {ops.walletAvailableUsd != null
              ? moneyUsd(ops.walletAvailableUsd)
              : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-white/10 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">
            {t("staffOpsAdLedger")}
          </p>
          <p className="mt-1 text-[1.05rem] font-semibold tabular-nums">
            {moneyUsd(ops.adLedgerAvailableUsd)}
          </p>
          <p className="mt-0.5 text-[11px] text-white/50">
            {t("staffOpsAccountsWithBal", {
              count: ops.accountsWithLedgerBalance,
            })}
          </p>
        </div>
        <div className="rounded-xl bg-white/10 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">
            {t("staffOpsLastAlloc")}
          </p>
          {ops.lastAllocation ? (
            <>
              <p className="mt-1 text-[1.05rem] font-semibold tabular-nums">
                {moneyUsd(ops.lastAllocation.amountUsd)}
              </p>
              <p className="mt-0.5 text-[11px] text-white/50">
                {ops.lastAllocation.accountLabel} ·{" "}
                {t("staffOpsHoursAgo", {
                  hours: ops.lastAllocation.hoursAgo,
                })}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-white/70">{t("staffOpsNoAlloc")}</p>
          )}
        </div>
        <div className="rounded-xl bg-white/10 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/50">
            {t("staffOpsBurn")}
          </p>
          <p className="mt-1 text-[1.05rem] font-semibold">
            {ops.burn.status === "none"
              ? t("staffOpsBurnNone")
              : ops.burn.status === "critical"
                ? t("severityCritical")
                : ops.burn.status === "warn"
                  ? t("severityWarn")
                  : t("severityInfo")}
          </p>
          <p className="mt-0.5 text-[11px] text-white/50">
            {t("staffOpsBurnCounts", {
              critical: ops.burn.critical,
              warn: ops.burn.warn,
              info: ops.burn.info,
            })}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 px-3.5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
            {t("staffOpsSpendToday")}
          </p>
          <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[#ffb080]">
            {moneyUsd(spendTodayUsd)}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 px-3.5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
            {t("staffOpsSpend7d")}
          </p>
          <p className="mt-0.5 text-[14px] font-semibold tabular-nums">
            {moneyUsd(spend7dUsd)}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 px-3.5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
            {t("staffOpsPacing")}
          </p>
          <p className="mt-0.5 text-[14px] font-semibold">
            {pacingLabel}
            {pacingRatio != null ? ` · ${pacingRatio.toFixed(2)}×` : ""}
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}

export function ProfitPageClient({
  clienteName,
  isStaff,
  initialFrom,
  initialTo,
  radarEnabled = false,
  radarInvite = false,
}: {
  clienteName: string;
  isStaff: boolean;
  initialFrom?: string;
  initialTo?: string;
  /** Muestra el selector Análisis · Radar (PROFIT_RADAR_ENABLED). */
  radarEnabled?: boolean;
  /** Muestra la invitación al Radar (el cliente aún no armó su perfil). */
  radarInvite?: boolean;
}) {
  const t = useTranslations("profit");
  const tCommon = useTranslations("common");
  const { bcp47 } = useAppFormatter();
  const [loading, setLoading] = useState(true);
  const firstLoadRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [staffOps, setStaffOps] = useState<StaffOps | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [bmFilter, setBmFilter] = useState<string>("all");
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  /** El cliente toca «Conectar TikTok Ads» para ver sus métricas (se recuerda en este navegador). */
  const tiktokKey = `profit.tiktokLinked.${clienteName}`;
  const [tiktokLinked, setTikTokLinked] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
      setTikTokLinked(window.localStorage.getItem(tiktokKey) === "1");
    } catch {
      /* sin storage: queda desconectado */
    }
  }, [tiktokKey]);
  function setTikTokLinkedPersist(on: boolean) {
    setTikTokLinked(on);
    try {
      window.localStorage.setItem(tiktokKey, on ? "1" : "0");
    } catch {
      /* sin storage */
    }
  }
  const [connections, setConnections] = useState<RpConnections | null>(null);
  const [realProfitUrl, setRealProfitUrl] = useState("https://realprofitcod.com");
  /** Link firmado con el cliente: instalar = vincular. */
  const [installUrl, setInstallUrl] = useState<string | null>(null);

  const live = useAdAccountLiveMetrics(true);
  const liveAccounts = useMemo(() => {
    return Object.values(live.metricsByAdvertiser)
      .filter(
        (a) =>
          (a.balanceUsd != null && a.balanceUsd > 0) ||
          (a.spendTodayUsd != null && a.spendTodayUsd > 0),
      )
      .sort(
        (a, b) => (b.spendTodayUsd ?? 0) - (a.spendTodayUsd ?? 0),
      );
  }, [live.metricsByAdvertiser]);
  const liveBalanceTotal = Object.values(live.metricsByAdvertiser).reduce(
    (s, a) => s + (a.balanceUsd ?? 0),
    0,
  );
  const liveSpendTotal = Object.values(live.metricsByAdvertiser).reduce(
    (s, a) => s + (a.spendTodayUsd ?? 0),
    0,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q =
        from && to
          ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
          : "";
      const res = await fetch(`/api/profit${q}`, { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        from?: string;
        to?: string;
        snapshots?: Snapshot[];
        analysis?: Analysis;
        staffOps?: StaffOps;
        connections?: RpConnections;
        installUrl?: string;
        realProfitUrl?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || t("loadError"));
      }
      setInstallUrl(json.installUrl ?? null);
      setAnalysis(json.analysis ?? null);
      setStaffOps(json.staffOps ?? null);
      setSnapshots(
        (json.snapshots ?? []).filter((s) => s.store.id !== "__holistic_tiktok__"),
      );
      setConnections(json.connections ?? null);
      if (json.realProfitUrl) setRealProfitUrl(json.realProfitUrl);
      const max = limaSpendMaxYmd();
      if (!from && json.from) {
        setFrom(json.from > max ? max : json.from);
      }
      if (!to && json.to) {
        setTo(json.to > max ? max : json.to);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("genericError"));
    } finally {
      setLoading(false);
    }
  }, [from, to, t]);

  useEffect(() => {
    if (from && to && from > to) {
      setError(t("dateOrderError"));
      return;
    }
    // Primera carga al toque; los cambios de fecha sí esperan un poco.
    const delay = firstLoadRef.current ? 0 : 280;
    firstLoadRef.current = false;
    const timer = window.setTimeout(() => {
      void refresh();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [from, to, refresh, t]);

  const bmOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of analysis?.campaigns ?? []) {
      if (c.bm?.trim()) set.add(c.bm.trim());
    }
    return [...set].sort();
  }, [analysis]);

  const sortedCampaigns = useMemo(() => {
    let rows = analysis?.campaigns ?? [];
    if (bmFilter !== "all") {
      rows = rows.filter((c) => (c.bm ?? "") === bmFilter);
    }
    const mul = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "name") {
        return mul * a.campaignName.localeCompare(b.campaignName);
      }
      if (sortKey === "share") return mul * (a.spendShare - b.spendShare);
      if (sortKey === "roas") {
        const ar = a.roasEstimated ?? -1;
        const br = b.roasEstimated ?? -1;
        return mul * (ar - br);
      }
      if (sortKey === "ctr") {
        const ar = a.ctr ?? -1;
        const br = b.ctr ?? -1;
        return mul * (ar - br);
      }
      if (sortKey === "cpc") {
        const ar = a.cpc ?? Number.POSITIVE_INFINITY;
        const br = b.cpc ?? Number.POSITIVE_INFINITY;
        return mul * (ar - br);
      }
      return mul * (a.spend - b.spend);
    });
  }, [analysis, bmFilter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  const useLiveForToday = Boolean(live.lastUpdatedAt) && !live.error;
  const spendTodayDisplay = useLiveForToday
    ? liveSpendTotal
    : (analysis?.spendToday ?? 0);
  const syncLabel = formatSyncTime(live.lastUpdatedAt, bcp47);
  const todayYmd = limaTodayYmd();
  const syncPart = syncLabel
    ? t("liveHintSync", { time: syncLabel })
    : "";
  const hoyHint = useLiveForToday
    ? liveBalanceTotal > 0
      ? t("liveHintWithBalance", {
          balance: moneyUsd(liveBalanceTotal),
          sync: syncPart,
        })
      : t("liveHintNoBalance", { sync: syncPart })
    : analysis
      ? t("snapshotsVsYesterday", {
          delta: formatDelta(analysis.spendTodayDeltaPct, t("noBaseline")),
        })
      : t("loadingLive");

  const displayPacing = useMemo(() => {
    if (!analysis) {
      return { pacingRatio: null as number | null, pacingLabel: "sin_base" as const };
    }
    const spendToday = useLiveForToday ? liveSpendTotal : analysis.spendToday;
    const spend7d = analysis.spend7d;
    if (spendToday <= 0 && spend7d <= 0) {
      return { pacingRatio: null, pacingLabel: "sin_base" as const };
    }
    if (spendToday <= 0) {
      return { pacingRatio: 0, pacingLabel: "parado" as const };
    }
    const avg = spend7d / 7;
    if (avg <= 0) {
      return { pacingRatio: null, pacingLabel: "sin_base" as const };
    }
    const ratio = Math.round((spendToday / avg) * 100) / 100;
    if (ratio >= 1.35) return { pacingRatio: ratio, pacingLabel: "acelerando" as const };
    if (ratio <= 0.5) return { pacingRatio: ratio, pacingLabel: "bajo" as const };
    return { pacingRatio: ratio, pacingLabel: "normal" as const };
  }, [analysis, useLiveForToday, liveSpendTotal]);

  const displaySignals = useMemo(() => {
    const raw = analysis?.signals ?? [];
    // Si hay gasto live, no mostrar "Sin gasto hoy" (snapshots pueden ir atrasados).
    if (spendTodayDisplay > 0.05) {
      return raw.filter((s) => s.kind !== "silent");
    }
    return raw;
  }, [analysis?.signals, spendTodayDisplay]);

  const staffOpsResolved = useMemo(() => {
    if (!isStaff) return null;
    if (staffOps) return { ops: staffOps, fromLiveFallback: false };
    return {
      ops: {
        walletAvailableUsd: null,
        adLedgerAvailableUsd: liveBalanceTotal,
        accountsWithLedgerBalance: liveAccounts.length,
        lastAllocation: null,
        burn: { critical: 0, warn: 0, info: 0, status: "none" as const },
        creditHint:
          spendTodayDisplay > 0
            ? `Gasto live hoy ${moneyUsd(spendTodayDisplay)} · saldo TikTok ~${moneyUsd(liveBalanceTotal)}. Ledger Holistic aún no cargó detalle de asignación.`
            : "Sin gasto live hoy. Cuando asigne y gaste, aquí verás quema y crédito.",
        score: null,
      },
      fromLiveFallback: true,
    };
  }, [
    isStaff,
    staffOps,
    liveBalanceTotal,
    liveAccounts.length,
    spendTodayDisplay,
  ]);

  const warnSignalCount = displaySignals.filter(
    (s) => s.severity === "warn" || s.severity === "critical",
  ).length;

  return (
    <div className="space-y-5">
      {radarEnabled ? (
        <div className="flex justify-end">
          <ProfitSectionSwitch active="analysis" />
        </div>
      ) : null}

      <RealProfitConnect
        connections={connections}
        installUrl={installUrl}
        realProfitUrl={realProfitUrl}
        onChanged={refresh}
        tiktokLinked={tiktokLinked}
        onTikTokLinkedChange={setTikTokLinkedPersist}
      />


      {radarInvite ? <RadarInviteCard /> : null}

      {error ? (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {/* Métricas TikTok: solo cuando el cliente conectó TikTok Ads en el panel. */}
      {tiktokLinked ? (
        <>
        <header className="relative overflow-hidden rounded-2xl border border-[#ece7e0] bg-[linear-gradient(145deg,#fffaf6_0%,#ffffff_45%,#f7f4ef_100%)] px-5 py-6 sm:px-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff781f]/[0.12] blur-3xl"
          />
          <div className="relative">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#ff781f]">
              {t("rp.tiktokTitle")}
            </p>
            <h2 className="mt-1.5 text-[1.35rem] font-bold tracking-[-0.03em] text-[#1c1917]">
              {t("heroTitle", { name: clienteName })}
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#5c564e]">
              {t("heroSubtitle")}
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <ProfitDateRangeField
                from={from}
                to={to}
                max={limaSpendMaxYmd()}
                onChange={({ from: nextFrom, to: nextTo }) => {
                  const max = limaSpendMaxYmd();
                  let f = nextFrom;
                  let t = nextTo;
                  if (t && t > max) t = max;
                  if (f && f > max) f = max;
                  if (f && t && f > t) f = t;
                  setFrom(f);
                  setTo(t);
                }}
              />
              {loading ? (
                <p className="pb-3 text-[11px] font-semibold text-[#c2410c]">
                  {tCommon("loading")}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <section className="space-y-4 rounded-2xl border border-[#ffd7b8] bg-[linear-gradient(160deg,#fffaf6_0%,#ffffff_55%,#fff7f0_100%)] p-5 shadow-[0_14px_36px_-24px_rgb(255_120_31_/_0.55)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
                {t("spendTodayTitle")}
              </p>
              <h2 className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]">
                {t("spendTodaySubtitle")}
              </h2>
              <p className="mt-0.5 text-[12px] text-[#8a8177]">{hoyHint}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p
                className={`text-[2rem] font-bold leading-none tabular-nums tracking-[-0.04em] sm:text-[2.3rem] ${
                  spendTodayDisplay > 0 ? "text-[#c2410c]" : "text-[#1c1917]"
                }`}
                aria-label={t("spendTodayLiveLabel", { date: formatDayShort(todayYmd, bcp47) })}
              >
                {live.loading && !live.lastUpdatedAt ? "…" : moneyUsd(spendTodayDisplay)}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${pacingBadgeClass(displayPacing.pacingLabel)}`}
              >
                {t(`pacing.${displayPacing.pacingLabel}`)}
                {displayPacing.pacingRatio != null
                  ? ` · ${displayPacing.pacingRatio.toFixed(2)}×`
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => void live.refresh({ force: true })}
                disabled={live.loading}
                className="rounded-full border border-[#ffd7b8] bg-white px-3 py-2.5 text-[11px] font-bold text-[#c2410c] sm:py-1.5 transition hover:bg-[#fff7f0] disabled:opacity-55"
              >
                {live.loading ? tCommon("loading") : t("refreshLive")}
              </button>
              </div>
            </div>
          </div>

          {liveAccounts.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {liveAccounts.slice(0, 6).map((acc) => (
                <li
                  key={acc.advertiserId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#f0ebe4] bg-white/80 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#1c1917]">
                      {acc.accountName}
                    </p>
                    <p className="truncate text-[11px] tabular-nums text-[#9a9187]">
                      {acc.bmBucket ? `${t("bmLabel")} ${acc.bmBucket} · ` : ""}
                      {acc.advertiserId}
                    </p>
                  </div>
                  <p className="shrink-0 text-[14px] font-bold tabular-nums text-[#c2410c]">
                    {moneyUsd(acc.spendTodayUsd ?? 0)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {live.error ? (
            <p className="text-[12px] font-medium text-amber-800" role="alert">
              {analysis
                ? t("liveFallback", {
                    error: live.error,
                    amount: moneyUsd(analysis.spendToday),
                  })
                : t("liveErrorOnly", { error: live.error })}
            </p>
          ) : null}
        </section>

        {loading && !analysis ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <span className="sr-only">{t("loadingAnalysis")}</span>
            <div className="h-24 animate-pulse rounded-2xl border border-[#ece7e0] bg-white" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl border border-[#ece7e0] bg-white"
                />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-2xl border border-[#ece7e0] bg-white" />
          </div>
        ) : analysis ? (
          <>
            {displaySignals.length > 0 ? (
              <section className="space-y-3 rounded-2xl border border-[#ece7e0] bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                      {t("signals")}
                    </p>
                    <h2 className="mt-1 text-[1.1rem] font-bold text-[#1c1917]">
                      {t("signalsTitle")}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-[#5c564e]">
                      {isStaff ? t("signalsStaffHint") : t("signalsClientHint")}
                    </p>
                  </div>
                  {isStaff ? (
                    <p className="rounded-lg bg-[#fff7f0] px-2.5 py-1 text-[11px] font-semibold text-[#c2410c]">
                      {t("signalsStaffBadge", {
                        warn: warnSignalCount,
                        total: displaySignals.length,
                      })}
                    </p>
                  ) : null}
                </div>
                <ul className="space-y-2">
                  {displaySignals.map((signal, idx) => {
                    const tone =
                      signal.severity === "critical"
                        ? "critical"
                        : signal.severity === "warn"
                          ? "warn"
                          : "info";
                    return (
                      <li
                        key={`${signal.kind}-${idx}-${signal.title}`}
                        className={`rounded-xl border px-3.5 py-3 ${
                          tone === "critical"
                            ? "border-[#fecaca] bg-[#fef2f2]"
                            : tone === "warn"
                              ? "border-[#ffd7b8] bg-[#fff7f0]"
                              : "border-[#ece7e0] bg-[#faf8f5]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
                              tone === "critical"
                                ? "bg-[#fee2e2] text-[#b91c1c]"
                                : tone === "warn"
                                  ? "bg-[#ffedd5] text-[#c2410c]"
                                  : "bg-[#e7e0d8] text-[#5c564e]"
                            }`}
                          >
                            {tone === "critical"
                              ? t("severityCritical")
                              : tone === "warn"
                                ? t("severityWarn")
                                : t("severityInfo")}
                          </span>
                          {isStaff ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a9187]">
                              {signal.kind}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[13px] font-semibold text-[#1c1917]">
                          {signal.title}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-5 text-[#5c564e]">
                          {signal.detail}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <section className="space-y-4 rounded-2xl border border-[#ece7e0] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                    {t("campaigns")}
                  </p>
                  <h2 className="mt-1 text-[1.1rem] font-bold text-[#1c1917]">
                    {t("campaignsSubtitle")}
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[#5c564e]">
                    {t("rangeMeta", {
                      range: formatRangeLabel(analysis.from, analysis.to, bcp47),
                    })}
                    {analysis.daysWithActivity
                      ? ` · ${t("daysWithSpend", { count: analysis.daysWithActivity })}`
                      : ""}
                    {analysis.perf?.fetchedAt
                      ? ` · ${t("perfUpdated", {
                          time:
                            formatSyncTime(analysis.perf.fetchedAt, bcp47) ?? "—",
                        })}`
                      : ""}
                    {` · ${t("inRangeSpend")} `}
                    <span className="font-semibold text-[#1c1917]">
                      {moneyUsd(analysis.spendInRange)}
                    </span>
                  </p>
                </div>
                {bmOptions.length > 0 ? (
                  <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a8177]">
                    BM
                    <select
                      className="mt-1 block min-w-[140px] rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2 text-[13px] font-medium text-[#1c1917]"
                      value={bmFilter}
                      onChange={(e) => setBmFilter(e.target.value)}
                    >
                      <option value="all">{t("allBm")}</option>
                      {bmOptions.map((bm) => (
                        <option key={bm} value={bm}>
                          {bm}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {analysis.perf ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Kpi
                    label={t("kpiImpressions")}
                    value={
                      analysis.perf.available
                        ? analysis.perf.impressions.toLocaleString(bcp47)
                        : "—"
                    }
                    hint={
                      analysis.perf.error
                        ? analysis.perf.error
                        : t("kpiAccountsOk", {
                            ok: analysis.perf.advertisersOk,
                            total: analysis.perf.advertisersQueried,
                          })
                    }
                  />
                  <Kpi
                    label={t("kpiClicks")}
                    value={
                      analysis.perf.available
                        ? analysis.perf.clicks.toLocaleString(bcp47)
                        : "—"
                    }
                    hint={
                      analysis.perf.conversions > 0
                        ? t("kpiConv", {
                            count: analysis.perf.conversions.toLocaleString(bcp47),
                          })
                        : t("kpiReportTikTok")
                    }
                  />
                  <Kpi
                    label={t("kpiAvgCtr")}
                    value={
                      analysis.perf.avgCtr != null
                        ? `${analysis.perf.avgCtr.toFixed(2)}%`
                        : "—"
                    }
                    hint={t("kpiCtrHint")}
                  />
                  <Kpi
                    label={t("kpiAvgCpc")}
                    value={
                      analysis.perf.avgCpc != null
                        ? moneyUsd(analysis.perf.avgCpc)
                        : "—"
                    }
                    hint={
                      analysis.perf.avgCpm != null
                        ? t("kpiCpmPrefix", {
                            amount: moneyUsd(analysis.perf.avgCpm),
                          })
                        : t("kpiSpendClicks")
                    }
                    accent
                  />
                </div>
              ) : null}

              {analysis.hasCodLink ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Kpi
                    label={t("kpiCollectedCod")}
                    value={formatMoney(analysis.collectedRevenue, "PEN")}
                    hint={t("kpiOrdersCollected", {
                      count: analysis.ordersCollected ?? 0,
                    })}
                  />
                  <Kpi
                    label={t("kpiCpaCollected")}
                    value={
                      analysis.cpaCollected != null
                        ? moneyUsd(analysis.cpaCollected)
                        : "—"
                    }
                    hint={t("kpiCpaHint")}
                  />
                  <Kpi
                    label={t("kpiRoasCollected")}
                    value={
                      analysis.roasCollected != null
                        ? `${analysis.roasCollected.toFixed(2)}x`
                        : "—"
                    }
                    hint={t("kpiRoasHint")}
                    accent
                  />
                  <Kpi
                    label={t("kpiRoasEffective")}
                    value={
                      analysis.roasEffective != null
                        ? `${analysis.roasEffective.toFixed(2)}x`
                        : "—"
                    }
                    hint={
                      analysis.aboveBreakEven == null
                        ? t("kpiBeFee", {
                            be: analysis.breakEvenRoas?.toFixed(2) ?? "—",
                            fee: analysis.feePercent ?? "—",
                          })
                        : analysis.aboveBreakEven
                          ? t("kpiAboveBe", {
                              be: analysis.breakEvenRoas?.toFixed(2) ?? "—",
                              fee: analysis.feePercent ?? "—",
                            })
                          : t("kpiBelowBe", {
                              be: analysis.breakEvenRoas?.toFixed(2) ?? "—",
                              fee: analysis.feePercent ?? "—",
                            })
                    }
                  />
                </div>
              ) : analysis.feePercent != null ? (
                <div className="rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-4 py-3 text-[12px] text-[#5c564e]">
                  {t("feeHolisticLine", {
                    fee: analysis.feePercent,
                    spend: moneyUsd(
                      analysis.effectiveAdSpend ?? analysis.spendInRange,
                    ),
                    be: analysis.breakEvenRoas?.toFixed(2) ?? "—",
                  })}{" "}
                  {t("emptyConnectStore")}
                </div>
              ) : null}

              {analysis.hasCodLink && analysis.netProfit != null ? (
                <div
                  className={`rounded-xl border px-4 py-3 ${
                    analysis.netProfit >= 0
                      ? "border-[#bfe3c9] bg-[#f2faf4]"
                      : "border-[#f3c4c4] bg-[#fdf3f3]"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9a9187]">
                    {t("netProfitLabel")}
                  </p>
                  <p
                    className={`mt-1 text-[1.35rem] font-bold tabular-nums tracking-[-0.02em] ${
                      analysis.netProfit >= 0 ? "text-[#15803d]" : "text-[#b91c1c]"
                    }`}
                  >
                    {formatMoney(analysis.netProfit, "PEN")}
                  </p>
                  <p className="mt-0.5 break-words text-[11px] text-[#5c564e]">
                    {t("netProfitBreakdown", {
                      collected: formatMoney(analysis.collectedRevenue, "PEN"),
                      product: formatMoney(analysis.cogsTotal ?? 0, "PEN"),
                      courier: formatMoney(analysis.courierTotal ?? 0, "PEN"),
                      ads: moneyUsd(
                        analysis.effectiveAdSpend ?? analysis.spendInRange,
                      ),
                    })}
                  </p>
                  {analysis.hasProductCosts === false ? (
                    <p className="mt-1 text-[11px] font-semibold text-[#b45309]">
                      {t("netProfitNoCosts")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {sortedCampaigns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-4 py-8 text-center">
                  <p className="text-[13px] font-semibold text-[#1c1917]">
                    {t("emptyCampaigns")}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-[#5c564e]">
                    {t("emptyTryRange")}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#ece7e0]">
                  <table className="min-w-[960px] w-full border-collapse text-left text-[11.5px]">
                    <thead className="sticky top-0 z-[1] bg-[#f7f4ef] text-[10px] uppercase tracking-[0.07em] text-[#9a9187]">
                      <tr>
                        <th className="sticky left-0 z-[2] bg-[#f7f4ef] px-2.5 py-2.5 sm:px-3">
                          <button
                            type="button"
                            className="font-bold uppercase tracking-[0.07em]"
                            onClick={() => toggleSort("name")}
                          >
                            {t("colCampaign")}
                          </button>
                        </th>
                        <th className="whitespace-nowrap px-2.5 py-2.5 font-bold">
                          {t("colDelivery")}
                        </th>
                        <th className="px-2.5 py-2.5 font-bold">{t("colBm")}</th>
                        <th className="px-2.5 py-2.5">
                          <button
                            type="button"
                            className="font-bold uppercase tracking-[0.07em]"
                            onClick={() => toggleSort("spend")}
                          >
                            {t("colSpend")}
                          </button>
                        </th>
                        <th className="px-2.5 py-2.5">
                          <button
                            type="button"
                            className="font-bold uppercase tracking-[0.07em]"
                            onClick={() => toggleSort("share")}
                          >
                            {t("colPct")}
                          </button>
                        </th>
                        <th className="px-2.5 py-2.5 font-bold">{t("colImp")}</th>
                        <th className="px-2.5 py-2.5 font-bold">{t("colClicks")}</th>
                        <th className="px-2.5 py-2.5">
                          <button
                            type="button"
                            className="font-bold uppercase tracking-[0.07em]"
                            onClick={() => toggleSort("ctr")}
                          >
                            {t("colCtr")}
                          </button>
                        </th>
                        <th className="px-2.5 py-2.5">
                          <button
                            type="button"
                            className="font-bold uppercase tracking-[0.07em]"
                            onClick={() => toggleSort("cpc")}
                          >
                            {t("colCpc")}
                          </button>
                        </th>
                        <th className="px-2.5 py-2.5 font-bold">{t("colCpm")}</th>
                        <th className="px-2.5 py-2.5 font-bold">{t("colConv")}</th>
                        <th className="px-2.5 py-2.5 font-bold">{t("colCpa")}</th>
                        {analysis.hasCodLink ? (
                          <>
                            <th className="px-2.5 py-2.5 font-bold">{t("colCharged")}</th>
                            <th className="px-2.5 py-2.5">
                              <button
                                type="button"
                                className="font-bold uppercase tracking-[0.07em]"
                                onClick={() => toggleSort("roas")}
                              >
                                {t("colRoas")}
                              </button>
                            </th>
                          </>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllCampaigns ? sortedCampaigns : sortedCampaigns.slice(0, CAMPAIGNS_PREVIEW)).map((c) => {
                        const idShown = c.campaignExternalId.startsWith("name:")
                          ? null
                          : c.campaignExternalId;
                        const deliveryDate = c.lastStatDate
                          ? formatDayShort(c.lastStatDate, bcp47)
                          : formatRangeLabel(analysis.from, analysis.to, bcp47);
                        const deliveryTime = c.hasTikTokPerf
                          ? formatSyncTime(analysis.perf?.fetchedAt ?? null, bcp47)
                          : null;
                        return (
                          <tr
                            key={`${c.platform}-${c.campaignExternalId}-${c.advertiserId ?? ""}`}
                            className="group border-t border-[#f0ebe4] hover:bg-[#fffaf6]"
                          >
                            <td className="sticky left-0 z-[1] max-w-[150px] bg-white px-2.5 py-2.5 group-hover:bg-[#fffaf6] sm:max-w-[240px] sm:px-3">
                              <p className="truncate font-semibold text-[#1c1917]">
                                {displayCampaignTitle(c.campaignName, c.campaignExternalId)}
                              </p>
                              {isStaff ? (
                                <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-[#9a9187]">
                                  {idShown ?? t("noId")}
                                  {c.advertiserId ? ` · ${c.advertiserId}` : ""}
                                </p>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2.5 align-top">
                              <p className="font-semibold tabular-nums text-[#1c1917]">
                                {deliveryDate}
                              </p>
                              {isStaff && deliveryTime ? (
                                <p className="mt-0.5 text-[10px] font-medium text-[#c2410c]">
                                  {t("updatedShort", { time: deliveryTime })}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums text-[#6b645c]">
                              {c.bm ?? "—"}
                            </td>
                            <td className="px-2.5 py-2.5 font-semibold tabular-nums text-[#1c1917]">
                              {moneyUsd(c.spend)}
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums text-[#6b645c]">
                              {(c.spendShare * 100).toFixed(1)}%
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums">
                              {c.impressions != null
                                ? c.impressions.toLocaleString(bcp47)
                                : "—"}
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums">
                              {c.clicks != null
                                ? c.clicks.toLocaleString(bcp47)
                                : "—"}
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums">
                              {c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums">
                              {c.cpc != null ? moneyUsd(c.cpc) : "—"}
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums">
                              {c.cpm != null ? moneyUsd(c.cpm) : "—"}
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums">
                              {c.conversions != null
                                ? c.conversions.toLocaleString(bcp47)
                                : "—"}
                            </td>
                            <td className="px-2.5 py-2.5 tabular-nums">
                              {c.costPerConversion != null
                                ? moneyUsd(c.costPerConversion)
                                : "—"}
                            </td>
                            {analysis.hasCodLink ? (
                              <>
                                <td className="px-2.5 py-2.5 tabular-nums">
                                  {formatMoney(c.collectedEstimated, "PEN")}
                                </td>
                                <td className="px-2.5 py-2.5 font-semibold tabular-nums text-[#c2410c]">
                                  {c.roasEstimated != null
                                    ? `${c.roasEstimated.toFixed(2)}x`
                                    : "—"}
                                </td>
                              </>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {sortedCampaigns.length > CAMPAIGNS_PREVIEW ? (
                    <button
                      type="button"
                      onClick={() => setShowAllCampaigns((v) => !v)}
                      className="w-full border-t border-[#f0ebe4] bg-[#faf8f5] py-2.5 text-[12px] font-semibold text-[#c2410c] transition hover:bg-[#fff7f0]"
                    >
                      {showAllCampaigns
                        ? t("campaignsShowLess")
                        : t("campaignsShowAll", { count: sortedCampaigns.length })}
                    </button>
                  ) : null}
                </div>
              )}
            </section>
          </>
        ) : null}
        </>
      ) : null}


      {snapshots.length > 0 ? (
        <section className="space-y-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            {t("snapshotCodTitle")}
          </p>
          {snapshots.map((snap) => (
            <div
              key={snap.store.id}
              className="grid grid-cols-2 gap-3 rounded-2xl border border-[#ece7e0] bg-white p-4 sm:grid-cols-4"
            >
              <div className="col-span-2 sm:col-span-4">
                <p className="text-[14px] font-bold text-[#1c1917]">
                  {snap.store.name}
                </p>
                <p className="text-[11px] text-[#8a8177]">
                  {t("snapshotOrdersHint")}
                </p>
              </div>
              <Kpi
                label={t("snapshotCollected")}
                value={formatMoney(snap.collectedRevenue, snap.store.currency)}
                hint={t("snapshotOrders", { count: snap.ordersCollected })}
              />
              <Kpi
                label={t("snapshotSpend")}
                value={formatMoney(snap.adSpend, snap.store.currency)}
                hint={t("snapSpendHint")}
              />
              <Kpi
                label={t("snapshotRoas")}
                value={
                  snap.roasCollected != null
                    ? `${snap.roasCollected.toFixed(2)}x`
                    : "—"
                }
                hint={t("snapRoasHint")}
                accent
              />
              <Kpi
                label={t("netProfitLabel")}
                value={
                  snap.netProfit != null
                    ? formatMoney(snap.netProfit, snap.store.currency)
                    : "—"
                }
                hint={t("snapNetHint")}
              />
            </div>
          ))}
        </section>
      ) : null}

      {isStaff ? (
        <section
          aria-labelledby="profit-staff-zone"
          className="space-y-5 border-t border-dashed border-[#e7e0d8] pt-6"
        >
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#ff781f]">
              {t("staffZoneEyebrow")}
            </p>
            <h2
              id="profit-staff-zone"
              className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]"
            >
              {t("staffZoneTitle")}
            </h2>
            <p className="mt-0.5 max-w-xl text-[12px] leading-5 text-[#5c564e]">
              {t("staffZoneHint")}
            </p>
          </div>
          {staffOpsResolved ? (
            <StaffOpsPanel
              ops={staffOpsResolved.ops}
              spendTodayUsd={spendTodayDisplay}
              spend7dUsd={analysis?.spend7d ?? 0}
              pacingLabel={displayPacing.pacingLabel}
              pacingRatio={displayPacing.pacingRatio}
              fromLiveFallback={staffOpsResolved.fromLiveFallback}
              t={t}
            />
          ) : null}
          {/* Rendimiento por producto y por anuncio: solo gerencia, el cliente no lo ve. */}
          {analysis ? <ProductPerformancePanel campaigns={analysis.campaigns} /> : null}
          {radarEnabled ? <ProfitPilotPanel /> : null}
          {radarEnabled && from && to ? <ProfitAdsTable from={from} to={to} /> : null}
          <ProfitAdvisorBot clienteName={clienteName} from={from} to={to} />
        </section>
      ) : null}

    </div>
  );
}

