"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CreativeDraftListItem } from "@/lib/creatives/types";
import { cleanCreativeDisplayName } from "@/lib/creatives/clean-display-name";
import { classifyTikTokRejectReasons } from "@/lib/creatives/tiktok-reject-action";
import { Button } from "@/components/ui/Button";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { cn } from "@/lib/cn";

type FilterId = "action" | "ready" | "all";

function isRejected(d: CreativeDraftListItem) {
  return d.status === "published" && d.tiktokReviewStatus === "rejected";
}

function isReady(d: CreativeDraftListItem) {
  return (
    d.status === "draft" || d.status === "approved" || d.status === "failed"
  );
}

function draftTitle(d: CreativeDraftListItem) {
  return cleanCreativeDisplayName(
    d.brief.adName || d.brief.campaignName || d.assetName || "",
  );
}

function reviewRank(d: CreativeDraftListItem): number {
  if (isRejected(d)) return 0;
  if (d.status === "failed") return 1;
  if (isReady(d)) return 2;
  return 3;
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

  const counts = useMemo(() => {
    let rejected = 0;
    let ready = 0;
    let failed = 0;
    for (const d of drafts) {
      if (isRejected(d)) rejected += 1;
      else if (d.status === "failed") failed += 1;
      else if (isReady(d)) ready += 1;
    }
    return {
      rejected,
      ready,
      failed,
      action: rejected + failed,
    };
  }, [drafts]);

  // Default: Problemas when there are rejects (client inbox), else Por enviar / Todos.
  const [filter, setFilter] = useState<FilterId>("action");
  const activeFilter: FilterId =
    filter === "action" && counts.action === 0 && drafts.length > 0
      ? counts.ready > 0
        ? "ready"
        : "all"
      : filter;

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
    if (activeFilter === "all") return sorted;
    if (activeFilter === "action") {
      return sorted.filter((d) => isRejected(d) || d.status === "failed");
    }
    return sorted.filter(isReady);
  }, [sorted, activeFilter]);

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
      if (action === "reject") setMessage(t("rejectedMsg"));
      else if (res.published || action === "publish")
        setMessage(t("publishedMsg"));
      else setMessage(t("approvedMsg"));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : t("updateError"),
      );
    } finally {
      setBusyId(null);
    }
  }

  const panelTitle =
    activeFilter === "action" || counts.action > 0
      ? t("titleProblems")
      : t("title");
  const panelSubtitle =
    counts.action > 0
      ? t("subtitleProblems", { count: counts.action })
      : publishEnabled
        ? t("subtitleEnabled")
        : t("subtitleDisabled");

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: "action", label: t("filterAction"), count: counts.action },
    { id: "ready", label: t("filterReady"), count: counts.ready },
    { id: "all", label: t("filterAll"), count: drafts.length },
  ];

  return (
    <CrmPanel title={panelTitle} subtitle={panelSubtitle}>
      {!publishEnabled ? (
        <p className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950 sm:mx-5">
          {t("publishHintBefore")}
          <code className="rounded bg-white px-1">
            TIKTOK_CREATIVE_PUBLISH_ENABLED=true
          </code>
          {t("publishHintAfter")}
        </p>
      ) : null}

      {counts.action > 0 ? (
        <div className="mx-4 mt-3 rounded-[1rem] border border-[#f0c4c4] bg-[linear-gradient(135deg,#fdf6f5_0%,#fff_75%)] px-3.5 py-3 sm:mx-5">
          <p className="text-[14px] font-bold tracking-[-0.02em] text-[#9b2c2c]">
            {t("inboxTitle", { count: counts.action })}
          </p>
          <p className="mt-1 text-[12px] leading-4 text-[#6b3f3f]">
            {t("inboxBody")}
          </p>
        </div>
      ) : drafts.length > 0 ? (
        <div className="mx-4 mt-3 rounded-[1rem] border border-[#c5e4d2] bg-[#f3faf6] px-3.5 py-3 sm:mx-5">
          <p className="text-[13px] font-semibold text-[#1f5c40]">
            {t("allClearTitle")}
          </p>
          <p className="mt-0.5 text-[11px] text-[#2f6b4f]">{t("allClearBody")}</p>
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
                activeFilter === f.id
                  ? f.id === "action" && f.count > 0
                    ? "bg-[#9b2c2c] text-white"
                    : "bg-[var(--auth-text)] text-white"
                  : "bg-[rgb(20_18_16_/_0.05)] text-[var(--auth-text-muted)] hover:bg-[rgb(20_18_16_/_0.08)]",
              )}
            >
              {f.label}
              <span className="tabular-nums opacity-80">{f.count}</span>
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
            {activeFilter === "action" ? t("noProblemsBody") : t("filterEmpty")}
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
            const title = draftTitle(draft);
            const rejected = isRejected(draft);
            const failed = draft.status === "failed";
            const canSend = isReady(draft);
            const canApproveOnly =
              draft.status === "draft" || draft.status === "failed";
            const canReject = draft.status === "draft";
            const actionKind = classifyTikTokRejectReasons(
              draft.tiktokRejectReasons,
            );
            const isDiscovered =
              draft.discoverSource === "tiktok_ads_manager";

            if (rejected) {
              return (
                <li
                  key={draft.id}
                  className="overflow-hidden rounded-[1.15rem] border border-[#e8a0a0] bg-white shadow-[0_8px_20px_rgb(20_18_16_/_0.03)] ring-1 ring-[#f0c4c4]/35"
                >
                  <div className="border-b border-[#f0c4c4]/50 bg-[linear-gradient(90deg,#fdf6f5,#fff)] px-3.5 py-3 sm:px-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                          {title}
                        </p>
                        {draft.accountName ? (
                          <p className="mt-1 truncate text-[11px] text-[var(--auth-text-muted)]">
                            {draft.accountName}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-md bg-[#fdeceb] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#9b2c2c] ring-1 ring-inset ring-[#f0c4c4]">
                        {t("tiktokRejected")}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 px-3.5 py-3 sm:px-4">
                    <p className="text-[12px] font-semibold text-[#9b2c2c]">
                      {t(`actionHint_${actionKind}`)}
                    </p>

                    {draft.tiktokRejectReasons.length > 0 ? (
                      <ul className="space-y-1.5">
                        {draft.tiktokRejectReasons.slice(0, 3).map((reason) => (
                          <li
                            key={reason.slice(0, 40)}
                            className="text-[12px] leading-5 text-[#5c3a3a]"
                          >
                            · {reason}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12px] leading-5 text-[#6b3f3f]">
                        {t("tiktokRejectNoReason")}
                      </p>
                    )}

                    <div className="rounded-lg bg-[rgb(20_18_16_/_0.03)] px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                        {t("nextStepLabel")}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--auth-text)]">
                        {t(`nextStep_${actionKind}`)}
                      </p>
                    </div>

                    {draft.hasActiveFix ? (
                      <p className="rounded-xl border border-[#c5e4d2] bg-[#f3faf6] px-3 py-2.5 text-[12px] font-semibold text-[#1f5c40]">
                        {t("fixInProgress")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Link
                          href={`?fixDraft=${encodeURIComponent(draft.id)}${
                            draft.adAccountId
                              ? `&fixAccount=${encodeURIComponent(draft.adAccountId)}`
                              : ""
                          }&fixLabel=${encodeURIComponent(title)}#creative-upload`}
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-3 text-[13px] font-bold text-white transition hover:brightness-[1.05]"
                        >
                          {t(`cta_${actionKind}`)}
                        </Link>
                        <p className="text-center text-[10px] text-[#9a7a7a] sm:max-w-[8rem] sm:text-left">
                          {t("noSupportHint")}
                        </p>
                      </div>
                    )}
                  </div>
                </li>
              );
            }

            return (
              <li
                key={draft.id}
                className={cn(
                  "overflow-hidden rounded-[1.15rem] border bg-white shadow-[0_8px_20px_rgb(20_18_16_/_0.03)]",
                  failed
                    ? "border-[#f0c4c4]"
                    : canSend
                      ? "border-[rgb(255_120_31_/_0.28)]"
                      : "border-[rgb(20_18_16_/_0.08)]",
                )}
              >
                <div className="border-b border-[rgb(20_18_16_/_0.06)] bg-[rgb(255_248_243_/_0.55)] px-3.5 py-2.5 sm:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                      {title}
                    </p>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-text-muted)] ring-1 ring-[rgb(20_18_16_/_0.08)]">
                      {failed
                        ? t("statusFailed")
                        : draft.status === "approved"
                          ? t("statusApproved")
                          : draft.status === "published"
                            ? t("statusPublished")
                            : t("statusDraft")}
                    </span>
                  </div>
                  {draft.accountName ? (
                    <p className="mt-1 truncate text-[11px] text-[var(--auth-text-muted)]">
                      {draft.accountName}
                    </p>
                  ) : null}
                  {draft.parentDraftId ? (
                    <p className="mt-1.5 inline-flex max-w-full truncate rounded-md bg-[rgb(255_120_31_/_0.1)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--auth-accent)]">
                      {t("fixOf", {
                        name: cleanCreativeDisplayName(
                          draft.parentLabel || t("briefFallback"),
                        ),
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 px-3.5 py-3 sm:px-4">
                  {failed && draft.errorMessage ? (
                    <p className="rounded-lg border border-[#f0c4c4] bg-[#fdf6f5] px-3 py-2 text-[12px] text-[#991b1b]">
                      {draft.errorMessage}
                    </p>
                  ) : null}

                  {!isDiscovered && draft.brief.hookCopy ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                        {t("hook")}
                      </p>
                      <p className="mt-0.5 text-[13px] font-medium leading-5 text-[var(--auth-text)]">
                        {draft.brief.hookCopy}
                      </p>
                    </div>
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
