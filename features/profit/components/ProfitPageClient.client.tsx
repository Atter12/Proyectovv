"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { ProfitDateRangeField } from "@/features/profit/components/ProfitDateRangeField.client";
import { ProfitAdvisorBot } from "@/features/profit/components/ProfitAdvisorBot.client";
import { formatMoney } from "@/lib/format-money";
import { moneyUsd } from "@/lib/format/money-usd";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import type { ClienteScore } from "@/lib/realprofit/client-score";

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
  spendSource?: "realprofit" | "holistic_tiktok" | "none";
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
      className={`rounded-xl border px-3.5 py-3.5 ${
        accent
          ? "border-[#ffd7b8] bg-[#fff7f0]"
          : "border-[#ece7e0] bg-white"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9a9187]">
        {label}
      </p>
      <p
        className={`mt-1 text-[1.25rem] font-bold tabular-nums tracking-[-0.02em] ${
          accent ? "text-[#c2410c]" : "text-[#1c1917]"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[#8a8177]">{hint}</p>
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
        className={`h-full rounded-full ${tone} motion-reduce:transition-none`}
        style={{
          width: `${width}%`,
          transition: "width 720ms cubic-bezier(0.22, 1, 0.36, 1)",
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
}: {
  clienteName: string;
  isStaff: boolean;
  initialFrom?: string;
  initialTo?: string;
}) {
  const t = useTranslations("profit");
  const tCommon = useTranslations("common");
  const { bcp47 } = useAppFormatter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [staffOps, setStaffOps] = useState<StaffOps | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [bmFilter, setBmFilter] = useState<string>("all");
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [subscription, setSubscription] = useState<RpSubscription | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);

  function openShopifyModal() {
    setShopifyModalOpen(true);
  }

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
        subscription?: RpSubscription | null;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || t("loadError"));
      }
      setAnalysis(json.analysis ?? null);
      setStaffOps(json.staffOps ?? null);
      setSnapshots(
        (json.snapshots ?? []).filter((s) => s.store.id !== "__holistic_tiktok__"),
      );
      setSubscription(json.subscription ?? null);
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

  const retryLinkStore = useCallback(async () => {
    setLinkBusy(true);
    setLinkErr(null);
    setLinkMsg(null);
    try {
      const res = await fetch("/api/profit/link-retry", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: shopDomain.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || t("shopifyLinkFailDefault"));
      }
      setLinkMsg(json.message || t("shopifyLinkedMsg"));
      await refresh();
    } catch (e) {
      setLinkErr(e instanceof Error ? e.message : t("shopifyLinkError"));
    } finally {
      setLinkBusy(false);
    }
  }, [shopDomain, refresh, t]);

  useEffect(() => {
    if (from && to && from > to) {
      setError(t("dateOrderError"));
      return;
    }
    const delay = from && to ? 280 : 0;
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
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-[#ece7e0] bg-[linear-gradient(145deg,#fffaf6_0%,#ffffff_45%,#f7f4ef_100%)] px-5 py-6 sm:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff781f]/[0.12] blur-3xl"
        />
        <div className="relative">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#ff781f]">
            {t("heroModule")}
          </p>
          <h1 className="mt-1.5 text-[1.55rem] font-bold tracking-[-0.035em] text-[#1c1917] sm:text-[1.75rem]">
            {t("heroTitle", { name: clienteName })}
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#5c564e]">
            {t("heroSubtitle")}
          </p>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950"
          role="alert"
        >
          {error}
        </div>
      ) : null}

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
          <div className="flex flex-wrap items-center gap-2">
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
              className="rounded-full border border-[#ffd7b8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#c2410c] transition hover:bg-[#fff7f0] disabled:opacity-55"
            >
              {live.loading ? tCommon("loading") : t("refreshLive")}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#ffd7b8]/80 bg-white px-5 py-5 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a9187]">
            {t("spendTodayLiveLabel", { date: formatDayShort(todayYmd, bcp47) })}
          </p>
          <p
            className={`mt-1 text-[2.35rem] font-bold tabular-nums tracking-[-0.04em] sm:text-[2.75rem] ${
              spendTodayDisplay > 0 ? "text-[#c2410c]" : "text-[#1c1917]"
            }`}
          >
            {live.loading && !live.lastUpdatedAt
              ? "…"
              : moneyUsd(spendTodayDisplay)}
          </p>
          {syncLabel ? (
            <p className="mt-1 text-[12px] text-[#8a8177]">
              {t("lastSyncPoll", {
                time: syncLabel,
                seconds: live.pollSeconds,
              })}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[#8a8177]">
              {t("queryingToday")}
            </p>
          )}
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

      {isStaff && staffOpsResolved ? (
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

      {isStaff ? (
        <ProfitAdvisorBot clienteName={clienteName} from={from} to={to} />
      ) : null}

      <section className="rounded-2xl border border-[#ece7e0] bg-white p-4 sm:p-5">
        <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
          {t("calendarRangeTitle")}
        </p>
        <p className="mb-3 max-w-xl text-[12.5px] leading-5 text-[#5c564e]">
          {t("calendarRangeBody")}
        </p>
        <div className="flex flex-wrap items-end gap-3">
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
      </section>

      {loading && !analysis ? (
        <p className="text-[13px] text-[#8a8177]">{t("loadingAnalysis")}</p>
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
                      <th className="sticky left-0 z-[2] bg-[#f7f4ef] px-3 py-2.5">
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
                    {sortedCampaigns.map((c) => {
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
                          className="border-t border-[#f0ebe4] hover:bg-[#fffaf6]"
                        >
                          <td className="sticky left-0 z-[1] max-w-[240px] bg-white px-3 py-2.5 hover:bg-[#fffaf6]">
                            <p className="truncate font-semibold text-[#1c1917]">
                              {displayCampaignTitle(c.campaignName, c.campaignExternalId)}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-[#9a9187]">
                              {idShown ?? t("noId")}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-[#b0a89e]">
                              {c.hasTikTokPerf
                                ? t("perfTikTok")
                                : t("onlyHolistic")}
                              {c.advertiserId ? ` · ${c.advertiserId}` : ""}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2.5 align-top">
                            <p className="font-semibold tabular-nums text-[#1c1917]">
                              {deliveryDate}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#9a9187]">
                              {c.lastStatDate
                                ? c.lastStatDate
                                : `${analysis.from}→${analysis.to}`}
                            </p>
                            {deliveryTime ? (
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
              </div>
            )}
          </section>
        </>
      ) : null}

      <section
        id="profit-shopify-connect"
        className="scroll-mt-6 overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white"
      >
        {subscription?.isActive && analysis && !analysis.hasCodLink ? (
          <div className="border-b border-[#ffd7b8] bg-[#fff7f0] px-5 py-4 sm:px-6">
            <p className="text-[13px] font-bold text-[#9a3412]">
              {t("shopifyCodPendingTitle")}
            </p>
            <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-[#9a3412]/90">
              {t("shopifyCodPendingBody", {
                action: t("shopifyAlreadyInstalled"),
              })}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                href={
                  shopDomain.trim()
                    ? `${(process.env.NEXT_PUBLIC_REALPROFIT_URL?.trim() || "https://www.realprofitcod.com").replace(/\/$/, "")}/api/shopify/auth?shop=${encodeURIComponent(normalizeShopDomain(shopDomain))}&surface=web`
                    : `${(process.env.NEXT_PUBLIC_REALPROFIT_URL?.trim() || "https://www.realprofitcod.com").replace(/\/$/, "")}/api/shopify/auth?surface=web`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#ffd7b8] bg-white px-4 text-[13px] font-semibold text-[#c2410c] transition hover:bg-[#fffaf6]"
              >
                  {t("modal.installInShopify")}
                </a>
              <button
                type="button"
                disabled={linkBusy}
                onClick={() => void retryLinkStore()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05] disabled:opacity-60"
              >
                {linkBusy ? t("shopifyLinking") : t("shopifyAlreadyInstalled")}
              </button>
            </div>
            {linkErr ? (
              <p className="mt-2 text-[12px] font-medium text-[#b91c1c]">
                {linkErr}
              </p>
            ) : null}
            {linkMsg ? (
              <p className="mt-2 text-[12px] font-medium text-emerald-800">
                {linkMsg}
              </p>
            ) : null}
          </div>
        ) : null}

        {analysis?.hasCodLink ? (
          <div className="border-b border-[var(--auth-divider)] px-5 py-5 sm:px-6">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700">
              {t("shopifyConnectedEyebrow")}
            </p>
            <h2 className="mt-1.5 text-[1.25rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
              {t("shopifyConnectedTitle")}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
              {t("shopifyConnectedBody")}
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--auth-divider)] bg-[linear-gradient(145deg,#fffaf6_0%,#ffffff_55%,#faf8f5_100%)] px-5 py-5 sm:px-6">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
                {t("shopifyOfferEyebrow")}
              </p>
              <h2 className="mt-1.5 max-w-lg text-[1.35rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)] sm:text-[1.45rem]">
                {t("shopifyOfferTitle")}
              </h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
                {t("shopifyOfferBodyBefore")}{" "}
                <span className="font-semibold text-[var(--auth-text)]">
                  {t("shopifyOfferBodyHighlight")}
                </span>{" "}
                {t("shopifyOfferBodyAfter")}
              </p>

              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {[
                  t("shopifyBenefit1"),
                  t("shopifyBenefit2"),
                  t("shopifyBenefit3"),
                  t("shopifyBenefit4"),
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[13px] leading-5 text-[var(--auth-text-muted)]"
                  >
                    <span
                      className="mt-0.5 font-semibold text-[var(--auth-accent)]"
                      aria-hidden
                    >
                      →
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-[var(--auth-divider)] pt-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
                    {t("shopifyPriceLabel")}
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span className="text-[15px] font-medium tabular-nums text-[#b0a89e] line-through">
                      $40
                    </span>
                    <span className="text-[1.35rem] font-bold tabular-nums text-[var(--auth-text)]">
                      $20
                    </span>
                    <span className="text-[12px] font-medium text-[var(--auth-text-muted)]">
                      {t("shopifyPerMonth")}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <p className="mb-3 text-[13px] font-semibold text-[var(--auth-text)]">
                {t("shopifyDomainLabel")}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--auth-border)] bg-[#faf8f5] transition focus-within:border-[var(--auth-accent)]/45 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--auth-accent)]/20">
                  <span className="flex items-center border-r border-[var(--auth-border)] bg-[#f3efe9] px-3 text-[12px] font-medium text-[var(--auth-text-muted)]">
                    https://
                  </span>
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    placeholder={t("shopifyDomainPlaceholder")}
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (
                          subscription?.isActive &&
                          analysis &&
                          !analysis.hasCodLink
                        ) {
                          void retryLinkStore();
                        } else {
                          openShopifyModal();
                        }
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] font-medium text-[var(--auth-text)] outline-none placeholder:text-[#b0a89e]"
                  />
                </div>
                {subscription?.isActive && analysis && !analysis.hasCodLink ? (
                  <button
                    type="button"
                    disabled={linkBusy}
                    onClick={() => void retryLinkStore()}
                    className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] disabled:opacity-60 sm:w-auto"
                  >
                    {linkBusy ? t("shopifyLinking") : t("shopifyLinkStore")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openShopifyModal}
                    className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] sm:w-auto"
                  >
                    {t("shopifyConnectCta")}
                  </button>
                )}
              </div>
              <p className="mt-4 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                {t("shopifyVoucherHint")}
              </p>
              <a
                href={`https://wa.me/51933484150?text=${encodeURIComponent(
                  t("shopifyWhatsappPrefill"),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-3 rounded-xl border border-[#dcfce7] bg-[#f0fdf4] px-3.5 py-2.5 transition hover:border-[#86efac] hover:bg-[#ecfdf5]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_12px_rgb(37_211_102_/_0.35)]">
                  <svg
                    className="h-[18px] w-[18px]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[13px] font-semibold text-[#166534]">
                    {t("shopifyWhatsappTitle")}
                  </span>
                  <span className="block text-[11.5px] text-[#15803d]/90">
                    {t("shopifyWhatsappSubtitle")}
                  </span>
                </span>
              </a>
            </div>
          </>
        )}
      </section>

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
            </div>
          ))}
        </section>
      ) : null}

      {shopifyModalOpen ? (
        <ShopifyConnectModal
          shopDomain={shopDomain}
          subscription={subscription}
          onSubscriptionChange={setSubscription}
          onLinked={async () => {
            await refresh();
          }}
          onClose={() => setShopifyModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function normalizeShopDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

type BankAccount = {
  id: string;
  label: string;
  bank?: string;
  holder: string;
  accountNumber: string;
  cci?: string;
  notes?: string;
};

type RpSubscription = {
  status: string;
  isActive: boolean;
  activeUntil: string | null;
};

function ShopifyConnectModal({
  shopDomain,
  onClose,
  subscription,
  onSubscriptionChange,
  onLinked,
}: {
  shopDomain: string;
  onClose: () => void;
  subscription: RpSubscription | null;
  onSubscriptionChange: (sub: RpSubscription) => void;
  onLinked?: () => void | Promise<void>;
}) {
  const t = useTranslations("profit");
  const tCommon = useTranslations("common");
  const tm = useTranslations("profit.modal");
  const [mounted, setMounted] = useState(false);
  const [payStep, setPayStep] = useState<"offer" | "deposit" | "done">(
    subscription?.isActive ? "done" : "offer",
  );
  const [loadingPay, setLoadingPay] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);
  const domain = normalizeShopDomain(shopDomain);
  const isActive = Boolean(subscription?.isActive);
  const awaitingReview = payStep === "done" && !isActive;

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function startDeposit() {
    setLoadingPay(true);
    setPayError(null);
    try {
      const res = await fetch("/api/profit/subscribe", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: domain || undefined }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        alreadyActive?: boolean;
        paymentIntentId?: string;
        bankAccounts?: BankAccount[];
        subscription?: RpSubscription;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || tm("payStartError"));
      }
      if (json.alreadyActive && json.subscription) {
        onSubscriptionChange(json.subscription);
        setPayStep("done");
        return;
      }
      setPaymentIntentId(json.paymentIntentId ?? null);
      setBankAccounts(json.bankAccounts ?? []);
      setPayStep("deposit");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : tm("payStartErrorShort"));
    } finally {
      setLoadingPay(false);
    }
  }

  async function uploadProof() {
    if (!paymentIntentId || !proofFile) {
      setPayError(tm("pickProof"));
      return;
    }
    setUploading(true);
    setPayError(null);
    try {
      const form = new FormData();
      form.append("proof", proofFile);
      const res = await fetch(`/api/payments/intents/${paymentIntentId}/proof`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || tm("uploadError"));
      }
      onSubscriptionChange({
        status: "pending_payment",
        isActive: false,
        activeUntil: null,
      });
      setPayStep("done");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : tm("uploadErrorShort"));
    } finally {
      setUploading(false);
    }
  }

  if (!mounted) return null;

  const realProfitUrl =
    process.env.NEXT_PUBLIC_REALPROFIT_URL?.trim() ||
    "https://www.realprofitcod.com";
  const installUrl = domain
    ? `${realProfitUrl.replace(/\/$/, "")}/api/shopify/auth?shop=${encodeURIComponent(domain)}&surface=web`
    : `${realProfitUrl.replace(/\/$/, "")}/api/shopify/auth?surface=web`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1c1917]/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopify-connect-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ece7e0] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f0ebe4] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
              {tm("compareEyebrow")}
            </p>
            <h3
              id="shopify-connect-title"
              className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]"
            >
              {payStep === "deposit"
                ? tm("depositTitle")
                : awaitingReview
                  ? tm("proofReviewTitle")
                  : isActive
                    ? tm("activeTitle")
                    : tm("offerTitle")}
            </h3>
            {domain ? (
              <p className="mt-1.5 font-mono text-[12px] text-[#8a8177]">
                {domain}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#8a8177] transition hover:bg-[#faf8f5] hover:text-[#1c1917]"
          >
            {tCommon("close")}
          </button>
        </div>

        {payStep === "offer" ? (
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="flex flex-col border-b border-[#f0ebe4] px-5 py-5 sm:border-b-0 sm:border-r sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
                {tm("includedEyebrow")}
              </p>
              <p className="mt-2 text-[15px] font-bold text-[#1c1917]">
                {tm("includedTitle")}
              </p>
              <ul className="mt-3 flex-1 space-y-2.5 text-[12.5px] leading-5 text-[#5c564e]">
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  {tm("freeFeature1")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  {tm("freeFeature2")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  {tm("freeFeature3")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  {tm("freeFeature4")}
                </li>
              </ul>
              <div className="mt-4 border-t border-[#f0ebe4] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8177]">
                  {tm("price")}
                </p>
                <p className="mt-1 text-[1.1rem] font-bold tabular-nums text-[#1c1917]">
                  $0{" "}
                  <span className="text-[12px] font-medium text-[#6b645c]">
                    · {tm("free")}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col px-5 py-5 sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#c2410c]">
                {t("shopifyOfferEyebrow")}
              </p>
              <p className="mt-2 text-[15px] font-bold text-[#1c1917]">
                {tm("paidTitle")}
              </p>
              <ul className="mt-3 flex-1 space-y-2.5 text-[12.5px] leading-5 text-[#5c564e]">
                <li className="flex gap-2">
                  <span className="mt-0.5 font-semibold text-[#c2410c]">→</span>
                  {t("shopifyBenefit1")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 font-semibold text-[#c2410c]">→</span>
                  {t("shopifyBenefit2")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 font-semibold text-[#c2410c]">→</span>
                  {t("shopifyBenefit3")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 font-semibold text-[#c2410c]">→</span>
                  {t("shopifyBenefit4")}
                </li>
              </ul>
              <div className="mt-4 border-t border-[#f0ebe4] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8177]">
                  {t("shopifyPriceLabel")}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-[14px] font-medium tabular-nums text-[#b0a89e] line-through">
                    $40
                  </span>
                  <span className="text-[1.1rem] font-bold tabular-nums text-[#1c1917]">
                    $20
                  </span>
                  <span className="text-[11px] font-medium text-[#6b645c]">
                    {t("shopifyPerMonth")}
                  </span>
                </p>
                {payError ? (
                  <p className="mt-2 text-[12px] text-[#b91c1c]">{payError}</p>
                ) : null}
                <button
                  type="button"
                  disabled={loadingPay}
                  onClick={() => void startDeposit()}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12] disabled:opacity-60"
                >
                  {loadingPay ? tm("preparing") : tm("payCta")}
                </button>
                <p className="mt-2 text-[11px] leading-4 text-[#9a9187]">
                  {tm("voucherShort")}
                </p>
                <a
                  href={`https://wa.me/51933484150?text=${encodeURIComponent(
                    t("shopifyWhatsappPrefill"),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dcfce7] bg-[#f0fdf4] px-3 py-2.5 text-[12.5px] font-semibold text-[#166534] transition hover:bg-[#ecfdf5]"
                >
                  <svg
                    className="h-4 w-4 text-[#25D366]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  {t("shopifyWhatsappTitle")}
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {payStep === "deposit" ? (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <p className="text-[13px] leading-5 text-[#5c564e]">
              {tm("depositBody")}
            </p>
            <div className="space-y-3">
              {bankAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-4 py-3"
                >
                  <p className="text-[12px] font-bold text-[#1c1917]">
                    {acc.label}
                  </p>
                  <p className="mt-1 text-[12px] text-[#5c564e]">
                    {tm("holder", { name: acc.holder })}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-[#1c1917]">
                    {tm("account", { number: acc.accountNumber })}
                  </p>
                  {acc.cci ? (
                    <p className="mt-0.5 font-mono text-[12px] text-[#1c1917]">
                      {tm("cci", { cci: acc.cci })}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
              {tm("proof")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="mt-1.5 block w-full text-[13px] font-medium normal-case tracking-normal text-[#1c1917]"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {payError ? (
              <p className="text-[12px] text-[#b91c1c]">{payError}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPayStep("offer")}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#e7e0d8] px-4 text-[13px] font-semibold text-[#5c564e]"
              >
                {tCommon("back")}
              </button>
              <button
                type="button"
                disabled={uploading || !proofFile}
                onClick={() => void uploadProof()}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#1c1917] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {uploading ? tm("uploading") : tm("sendVoucher")}
              </button>
            </div>
          </div>
        ) : null}

        {payStep === "done" ? (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {isActive ? (
              <>
                <p className="text-[13px] leading-5 text-[#5c564e]">
                  {subscription?.activeUntil
                    ? tm("activeUntil", {
                        date: subscription.activeUntil.slice(0, 10),
                      })
                    : tm("activeNoUntil")}
                </p>
                <a
                  href={installUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12]"
                >
                  {tm("installInShopify")}
                </a>
                <button
                  type="button"
                  disabled={linkBusy}
                  onClick={() => {
                    void (async () => {
                      setLinkBusy(true);
                      setLinkFeedback(null);
                      setPayError(null);
                      try {
                        const res = await fetch("/api/profit/link-retry", {
                          method: "POST",
                          cache: "no-store",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            shopDomain: domain || undefined,
                          }),
                        });
                        const json = (await res.json()) as {
                          ok?: boolean;
                          message?: string;
                          error?: string;
                        };
                        if (!res.ok || !json.ok) {
                          throw new Error(
                            json.error || t("shopifyLinkFailDefault"),
                          );
                        }
                        setLinkFeedback(json.message || t("shopifyLinkedMsg"));
                        await onLinked?.();
                      } catch (e) {
                        setPayError(
                          e instanceof Error
                            ? e.message
                            : t("shopifyLinkError"),
                        );
                      } finally {
                        setLinkBusy(false);
                      }
                    })();
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#e7e0d8] bg-white px-4 text-[13px] font-semibold text-[#1c1917] transition hover:bg-[#faf8f5] disabled:opacity-60"
                >
                  {linkBusy ? t("shopifyLinking") : t("shopifyAlreadyInstalled")}
                </button>
                {linkFeedback ? (
                  <p className="text-[12px] font-medium text-emerald-800">
                    {linkFeedback}
                  </p>
                ) : null}
                {payError ? (
                  <p className="text-[12px] text-[#b91c1c]">{payError}</p>
                ) : null}
              </>
            ) : (
              <p className="text-[13px] leading-5 text-[#5c564e]">
                {tm("proofSent")}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
