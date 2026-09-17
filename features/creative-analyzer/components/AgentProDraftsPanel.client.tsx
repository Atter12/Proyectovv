"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CreativeDraftListItem } from "@/lib/creatives/types";
import { classifyTikTokRejectReasons } from "@/lib/creatives/tiktok-reject-action";
import { Button } from "@/components/ui/Button";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { cn } from "@/lib/cn";

type FilterId = "all" | "action" | "review" | "ready";

function reviewRank(d: CreativeDraftListItem): number {
  if (d.status === "published" && d.tiktokReviewStatus === "rejected") return 0;
  if (d.status === "failed") return 1;
  if (d.status === "published" && d.tiktokReviewStatus === "pending") return 2;
  if (d.status === "draft" || d.status === "approved") return 3;
  if (d.status === "published" && d.tiktokReviewStatus === "approved") return 4;
  return 5;
}

export function AgentProDraftsPanel({
  drafts,
  publishEnabled,
}: {
  drafts: CreativeDraftListItem[];
  publishEnabled: boolean;
}) {
  const t = useTranslations("creatives.drafts");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [expandedBrief, setExpandedBrief] = useState<Record<string, boolean>>(
    {},
  );

  const counts = useMemo(() => {
    let rejected = 0;
    let pending = 0;
    let ready = 0;
    for (const d of drafts) {
      if (d.status === "published" && d.tiktokReviewStatus === "rejected") {
        rejected += 1;
      } else if (
        d.status === "published" &&
        (d.tiktokReviewStatus === "pending" ||
          d.tiktokReviewStatus === "unknown")
      ) {
        pending += 1;
      } else if (
        d.status === "draft" ||
        d.status === "failed" ||
        d.status === "approved"
      ) {
        ready += 1;
      }
    }
    return { rejected, pending, ready, action: rejected };
  }, [drafts]);

  const sorted = useMemo(
    () =>
      [...drafts].sort((a, b) => {
        const r = reviewRank(a) - reviewRank(b);
        if (r !== 0) return r;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),
    [drafts],
  );

  const visible = useMemo(() => {
    if (filter === "all") return sorted;
    return sorted.filter((d) => {
      if (filter === "action") {
        return (
          (d.status === "published" && d.tiktokReviewStatus === "rejected") ||
          d.status === "failed"
        );
      }
      if (filter === "review") {
        return (
          d.status === "published" &&
          (d.tiktokReviewStatus === "pending" ||
            d.tiktokReviewStatus === "unknown")
        );
      }
      return (
        d.status === "draft" ||
        d.status === "approved" ||
        d.status === "failed"
      );
    });
  }, [sorted, filter]);

  function statusLabel(status: string) {
    switch (status) {
      case "draft":
        return t("statusDraft");
      case "approved":
        return t("statusApproved");
      case "rejected":
        return t("statusRejected");
      case "publishing":
        return t("statusPublishing");
      case "published":
        return t("statusPublished");
      case "failed":
        return t("statusFailed");
      default:
        return status;
    }
  }

  function tiktokReviewLabel(status: string | null) {
    switch (status) {
      case "rejected":
        return t("tiktokRejected");
      case "approved":
        return t("tiktokApproved");
      case "pending":
        return t("tiktokPending");
      case "unknown":
        return t("tiktokUnknown");
      default:
        return null;
    }
  }

  async function runAction(
    draftId: string,
    action: "approve" | "reject" | "publish",
    publish = false,
  ) {
    setBusyId(draftId);
    setError(null);
    setMessage(null);
    try {
      const res = await apiClient<{
        ok: boolean;
        status?: string;
        published?: boolean;
      }>("/api/creative-drafts", {
        method: "POST",
        body: JSON.stringify({ draftId, action, publish }),
      });
      if (action === "reject") {
        setMessage(t("rejectedMsg"));
      } else if (res.published || action === "publish") {
        setMessage(t("publishedMsg"));
      } else {
        setMessage(t("approvedMsg"));
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : t("updateError"),
      );
    } finally {
      setBusyId(null);
    }
  }

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: "all", label: t("filterAll"), count: drafts.length },
    {
      id: "action",
      label: t("filterAction"),
      count: counts.rejected + drafts.filter((d) => d.status === "failed").length,
    },
    { id: "review", label: t("filterReview"), count: counts.pending },
    { id: "ready", label: t("filterReady"), count: counts.ready },
  ];

  return (
    <CrmPanel
      title={t("title")}
      subtitle={
        publishEnabled ? t("subtitleEnabled") : t("subtitleDisabled")
      }
    >
      {!publishEnabled ? (
        <p className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950 sm:mx-5">
          {t("publishHintBefore")}
          <code className="rounded bg-white px-1">
            TIKTOK_CREATIVE_PUBLISH_ENABLED=true
          </code>
          {t("publishHintAfter")}
        </p>
      ) : null}

      {counts.rejected > 0 ? (
        <div className="mx-4 mt-3 flex flex-col gap-2 rounded-[1rem] border border-[#f0c4c4] bg-[linear-gradient(135deg,#fdf6f5_0%,#fff_70%)] px-3.5 py-3 sm:mx-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-bold tracking-[-0.02em] text-[#9b2c2c]">
              {t("inboxTitle", { count: counts.rejected })}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-[#6b3f3f]">
              {t("inboxBody")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilter("action")}
            className="shrink-0 rounded-lg bg-[#9b2c2c] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110"
          >
            {t("inboxCta")}
          </button>
        </div>
      ) : null}

      {error ? (
        <p
          className="mx-4 mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b] sm:mx-5"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mx-4 mt-3 rounded-lg bg-[#ecf7f0] px-3 py-2 text-[12px] text-[#1f5c40] sm:mx-5">
          {message}
        </p>
      ) : null}

      {drafts.length > 0 ? (
        <div className="mx-4 mt-3 flex gap-1.5 overflow-x-auto pb-0.5 sm:mx-5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                filter === f.id
                  ? f.id === "action" && f.count > 0
                    ? "bg-[#9b2c2c] text-white"
                    : "bg-[var(--auth-text)] text-white"
                  : "bg-[rgb(20_18_16_/_0.05)] text-[var(--auth-text-muted)] hover:bg-[rgb(20_18_16_/_0.08)]",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "tabular-nums",
                  filter === f.id ? "opacity-80" : "text-[var(--auth-text-soft)]",
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {drafts.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-[14px] font-semibold text-[var(--auth-text)]">
            {t("emptyTitle")}
          </p>
          <p className="mt-1.5 text-[13px] text-[var(--auth-text-muted)]">
            {t("emptyBody")}
          </p>
          <Link
            href="#creative-upload"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[var(--auth-accent)] px-4 text-[13px] font-bold text-white transition hover:brightness-[1.05]"
          >
            {t("emptyCta")}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="px-4 py-8 text-center sm:px-5">
          <p className="text-[13px] font-medium text-[var(--auth-text-muted)]">
            {t("filterEmpty")}
          </p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-2 text-[12px] font-semibold text-[var(--auth-accent)] hover:underline"
          >
            {t("filterShowAll")}
          </button>
        </div>
      ) : (
        <ul className="max-h-[36rem] space-y-3 overflow-y-auto p-3 sm:p-4">
          {visible.map((draft) => {
            const canSend =
              draft.status === "draft" ||
              draft.status === "failed" ||
              draft.status === "approved";
            const canApproveOnly =
              draft.status === "draft" || draft.status === "failed";
            const canReject = draft.status === "draft";
            const tiktokRejected =
              draft.status === "published" &&
              draft.tiktokReviewStatus === "rejected";
            const tiktokPending =
              draft.status === "published" &&
              (draft.tiktokReviewStatus === "pending" ||
                draft.tiktokReviewStatus === "unknown");
            const tiktokApproved =
              draft.status === "published" &&
              draft.tiktokReviewStatus === "approved";
            const tiktokLabel = tiktokReviewLabel(draft.tiktokReviewStatus);
            const actionKind = classifyTikTokRejectReasons(
              draft.tiktokRejectReasons,
            );
            const showBrief =
              !tiktokRejected || expandedBrief[draft.id] === true;

            return (
              <li
                key={draft.id}
                className={cn(
                  "overflow-hidden rounded-[1.15rem] border bg-white shadow-[0_8px_20px_rgb(20_18_16_/_0.03)] transition",
                  tiktokRejected
                    ? "border-[#e8a0a0] ring-1 ring-[#f0c4c4]/40"
                    : tiktokPending
                      ? "border-[#f0d9b0]"
                      : tiktokApproved
                        ? "border-[#c5e4d2]"
                        : canSend
                          ? "border-[rgb(255_120_31_/_0.28)]"
                          : "border-[rgb(20_18_16_/_0.08)]",
                )}
              >
                <div
                  className={cn(
                    "border-b border-[rgb(20_18_16_/_0.06)] px-3.5 py-2.5 sm:px-4",
                    tiktokRejected
                      ? "bg-[linear-gradient(90deg,#fdf6f5,#fff)]"
                      : tiktokPending
                        ? "bg-[linear-gradient(90deg,#fff7eb,#fff)]"
                        : tiktokApproved
                          ? "bg-[linear-gradient(90deg,#f3faf6,#fff)]"
                          : "bg-[rgb(255_248_243_/_0.55)]",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                      {draft.brief.campaignName ||
                        draft.assetName ||
                        t("briefFallback")}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!tiktokRejected ? (
                        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-text-muted)] ring-1 ring-[rgb(20_18_16_/_0.08)]">
                          {statusLabel(draft.status)}
                        </span>
                      ) : null}
                      {tiktokLabel ? (
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ring-1 ring-inset",
                            draft.tiktokReviewStatus === "rejected"
                              ? "bg-[#fdeceb] text-[#9b2c2c] ring-[#f0c4c4]"
                              : draft.tiktokReviewStatus === "approved"
                                ? "bg-[#ecf7f0] text-[#1f5c40] ring-[#c5e4d2]"
                                : "bg-[#fff7eb] text-[#92400e] ring-[#f0d9b0]",
                          )}
                        >
                          {tiktokLabel}
                        </span>
                      ) : null}
                      {draft.discoverSource === "tiktok_ads_manager" ? (
                        <span className="rounded-md bg-[rgb(20_18_16_/_0.05)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-text-muted)] ring-1 ring-[rgb(20_18_16_/_0.08)]">
                          {t("fromAdsManager")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--auth-text-muted)]">
                    {[
                      draft.accountName,
                      draft.brief.objective,
                      t("perDay", {
                        amount: draft.brief.suggestedDailyBudgetUsd,
                      }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {draft.parentDraftId ? (
                    <p className="mt-1.5 inline-flex max-w-full items-center truncate rounded-md bg-[rgb(255_120_31_/_0.1)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--auth-accent)]">
                      {t("fixOf", {
                        name: draft.parentLabel || t("briefFallback"),
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2.5 px-3.5 py-3 sm:px-4">
                  {tiktokRejected ? (
                    <div className="overflow-hidden rounded-[0.9rem] border border-[#f0c4c4] bg-[#fdf8f7]">
                      <div className="border-b border-[#f0c4c4]/60 bg-[#faf0ee] px-3 py-2.5">
                        <p className="text-[12px] font-bold text-[#9b2c2c]">
                          {t("tiktokRejectTitle")}
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-[#6b3f3f]">
                          {t(`actionHint_${actionKind}`)}
                        </p>
                      </div>

                      <div className="space-y-2.5 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a7a7a]">
                          {t("tiktokRejectReasonsLabel")}
                        </p>
                        {draft.tiktokRejectReasons.length > 0 ? (
                          <ol className="space-y-2">
                            {draft.tiktokRejectReasons.map((reason, i) => (
                              <li
                                key={`${i}-${reason.slice(0, 24)}`}
                                className="flex gap-2.5 text-[12px] leading-5 text-[#5c3a3a]"
                              >
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fdeceb] text-[10px] font-bold text-[#9b2c2c]">
                                  {i + 1}
                                </span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-[12px] leading-5 text-[#6b3f3f]">
                            {t("tiktokRejectNoReason")}
                          </p>
                        )}

                        <div className="rounded-lg border border-[rgb(20_18_16_/_0.06)] bg-white/80 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                            {t("nextStepLabel")}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--auth-text)]">
                            {t(`nextStep_${actionKind}`)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 pt-0.5 sm:flex-row sm:items-center">
                          {draft.hasActiveFix ? (
                            <p className="flex-1 rounded-xl border border-[#c5e4d2] bg-[#f3faf6] px-3 py-2.5 text-[12px] font-semibold text-[#1f5c40]">
                              {t("fixInProgress")}
                            </p>
                          ) : (
                            <Link
                              href={`?fixDraft=${encodeURIComponent(draft.id)}${
                                draft.adAccountId
                                  ? `&fixAccount=${encodeURIComponent(draft.adAccountId)}`
                                  : ""
                              }&fixLabel=${encodeURIComponent(
                                draft.brief.campaignName ||
                                  draft.assetName ||
                                  t("briefFallback"),
                              )}#creative-upload`}
                              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-3 text-[12px] font-bold text-white transition hover:brightness-[1.05]"
                            >
                              {t(`cta_${actionKind}`)}
                            </Link>
                          )}
                          <p className="text-center text-[10px] leading-4 text-[#9a7a7a] sm:max-w-[9.5rem] sm:text-left">
                            {t("noSupportHint")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {tiktokPending ? (
                    <div className="rounded-[0.9rem] border border-[#f0d9b0] bg-[#fffaf3] px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-[#92400e]">
                        {t("tiktokPendingTitle")}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-[#a16207]">
                        {t("tiktokPendingHint")}
                      </p>
                    </div>
                  ) : null}

                  {tiktokApproved ? (
                    <div className="rounded-[0.9rem] border border-[#c5e4d2] bg-[#f3faf6] px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-[#1f5c40]">
                        {t("tiktokApprovedTitle")}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-[#2f6b4f]">
                        {t("tiktokApprovedHint")}
                      </p>
                    </div>
                  ) : null}

                  {draft.errorMessage && !tiktokRejected ? (
                    <p className="rounded-lg border border-[#f0c4c4] bg-[#fdf6f5] px-3 py-2 text-[12px] text-[#991b1b]">
                      {draft.errorMessage}
                    </p>
                  ) : null}

                  {tiktokRejected ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedBrief((prev) => ({
                          ...prev,
                          [draft.id]: !prev[draft.id],
                        }))
                      }
                      className="text-[11px] font-semibold text-[var(--auth-text-muted)] hover:text-[var(--auth-text)] hover:underline"
                    >
                      {showBrief ? t("hideBrief") : t("showBrief")}
                    </button>
                  ) : null}

                  {showBrief ? (
                    <>
                      {draft.brief.hookCopy ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                            {t("hook")}
                          </p>
                          <p className="mt-0.5 text-[13px] font-medium leading-5 text-[var(--auth-text)]">
                            {draft.brief.hookCopy}
                          </p>
                        </div>
                      ) : null}
                      {draft.brief.adText ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                            {t("adText")}
                          </p>
                          <p className="mt-0.5 text-[13px] leading-5 text-[var(--auth-text-muted)]">
                            {draft.brief.adText}
                          </p>
                        </div>
                      ) : null}
                      {draft.brief.audience ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                            {t("audience")}
                          </p>
                          <p className="mt-0.5 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                            {draft.brief.audience}
                          </p>
                        </div>
                      ) : null}
                      <p className="text-[11px] text-[var(--auth-text-soft)]">
                        {draft.brief.adgroupName} → {draft.brief.adName}
                      </p>
                    </>
                  ) : null}
                </div>

                {canSend ? (
                  <div className="flex flex-col gap-2 border-t border-[rgb(20_18_16_/_0.06)] bg-[rgb(255_252_248)] px-3.5 py-3 sm:flex-row sm:px-4">
                    <Button
                      size="sm"
                      disabled={busyId === draft.id || !publishEnabled}
                      onClick={() => {
                        if (draft.status === "approved") {
                          void runAction(draft.id, "publish");
                        } else {
                          void runAction(draft.id, "approve", true);
                        }
                      }}
                      className="h-10 flex-1 rounded-xl bg-[var(--auth-accent)] text-[13px] font-bold text-white disabled:opacity-50"
                    >
                      {busyId === draft.id ? t("sending") : t("sendToTikTok")}
                    </Button>
                    {canApproveOnly ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === draft.id}
                        onClick={() =>
                          void runAction(draft.id, "approve", false)
                        }
                        className="h-10 flex-1 rounded-xl border-[rgb(20_18_16_/_0.12)] text-[13px] font-semibold"
                      >
                        {t("approveOnly")}
                      </Button>
                    ) : null}
                    {canReject ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === draft.id}
                        onClick={() => void runAction(draft.id, "reject")}
                        className="h-10 rounded-xl border-[rgb(20_18_16_/_0.12)] text-[13px] font-semibold text-[var(--auth-text-muted)] sm:px-4"
                      >
                        {t("reject")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </CrmPanel>
  );
}
