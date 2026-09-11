"use client";

import { useTranslations } from "next-intl";
import type { CreativeAssetListItem } from "@/lib/creatives/types";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { cn } from "@/lib/cn";

function ScoreRing({
  score,
  scoreLabel,
}: {
  score: number;
  scoreLabel: string;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const offset = c * (1 - pct);
  return (
    <div className="relative h-[64px] w-[64px] shrink-0">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="rgb(20 18 16 / 0.08)"
          strokeWidth="5"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--auth-accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-bold tabular-nums leading-none text-[var(--auth-text)]">
          {score}
        </span>
        <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
          {scoreLabel}
        </span>
      </div>
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--auth-text-soft)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--auth-text-muted)]">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(20_18_16_/_0.06)]">
        <div
          className="h-full rounded-full bg-[var(--auth-accent)] transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function CreativeAssetsPanel({
  assets,
}: {
  assets: CreativeAssetListItem[];
}) {
  const t = useTranslations("creatives.assets");

  function jobLabel(status: string | null) {
    if (!status) return t("jobNone");
    if (status === "queued" || status === "pending") return t("jobQueued");
    if (status === "processing") return t("jobProcessing");
    if (status === "completed") return t("jobCompleted");
    if (status === "failed") return t("jobFailed");
    return status;
  }

  function verdictFromScore(score: number, policyRisks: string[]) {
    if (policyRisks.length > 0 && score < 70) {
      return { label: t("verdictPolicy"), tone: "warn" as const };
    }
    if (score >= 80) return { label: t("verdictReady"), tone: "good" as const };
    if (score >= 60) return { label: t("verdictImprove"), tone: "mid" as const };
    return { label: t("verdictRedo"), tone: "bad" as const };
  }

  return (
    <CrmPanel title={t("title")} subtitle={t("subtitle")}>
      {assets.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-[14px] font-semibold text-[var(--auth-text)]">
            {t("emptyTitle")}
          </p>
          <p className="mt-1.5 text-[13px] text-[var(--auth-text-muted)]">
            {t("emptyBody")}
          </p>
        </div>
      ) : (
        <ul className="max-h-[32rem] space-y-3 overflow-y-auto p-3 sm:p-4">
          {assets.map((asset) => {
            const insight = asset.insight;
            const verdict = insight
              ? verdictFromScore(insight.overallScore, insight.policyRisks)
              : null;
            return (
              <li
                key={asset.id}
                className="rounded-[1.1rem] border border-[rgb(20_18_16_/_0.08)] bg-white p-3.5 shadow-[0_8px_20px_rgb(20_18_16_/_0.03)] sm:p-4"
              >
                <div className="flex gap-3.5">
                  {insight ? (
                    <ScoreRing score={insight.overallScore} scoreLabel={t("score")} />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[rgb(255_248_243_/_0.9)] text-[11px] font-semibold text-[var(--auth-text-muted)]">
                      …
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
                          {asset.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--auth-text-muted)]">
                          {[
                            asset.assetType,
                            asset.accountName,
                            jobLabel(asset.jobStatus),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {verdict ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em]",
                            verdict.tone === "good" &&
                              "bg-[#ecf7f0] text-[#1f5c40]",
                            verdict.tone === "mid" &&
                              "bg-[rgb(255_120_31_/_0.12)] text-[var(--auth-accent)]",
                            verdict.tone === "warn" &&
                              "bg-amber-50 text-amber-900",
                            verdict.tone === "bad" &&
                              "bg-[#fef2f2] text-[#991b1b]",
                          )}
                        >
                          {verdict.label}
                        </span>
                      ) : null}
                    </div>

                    {insight ? (
                      <>
                        <p className="mt-2.5 text-[13px] leading-5 text-[var(--auth-text)]">
                          {insight.summary}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <MetricBar label={t("clarity")} value={insight.clarityScore} />
                          <MetricBar label={t("brand")} value={insight.brandScore} />
                          <MetricBar
                            label={t("policy")}
                            value={insight.complianceScore}
                          />
                        </div>
                        {insight.hooks.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {insight.hooks.slice(0, 4).map((hook) => (
                              <span
                                key={hook}
                                className="rounded-md bg-[rgb(20_18_16_/_0.04)] px-2 py-1 text-[11px] font-medium text-[var(--auth-text-muted)]"
                              >
                                {hook}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {insight.whyItMayPerform ? (
                          <p className="mt-2.5 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                            <span className="font-semibold text-[var(--auth-text)]">
                              {t("whyItMayPerform")}
                            </span>
                            {insight.whyItMayPerform}
                          </p>
                        ) : null}
                        {insight.policyRisks.length > 0 ? (
                          <p className="mt-2 text-[12px] leading-5 text-amber-900">
                            <span className="font-semibold">{t("policyRisk")}</span>
                            {insight.policyRisks.join(" · ")}
                          </p>
                        ) : null}
                      </>
                    ) : asset.jobStatus === "failed" ? (
                      <p className="mt-2 text-[12px] text-[#991b1b]">
                        {t("analysisFailed")}
                      </p>
                    ) : (
                      <p className="mt-2 text-[12px] text-[var(--auth-text-muted)]">
                        {t("analyzing")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CrmPanel>
  );
}
