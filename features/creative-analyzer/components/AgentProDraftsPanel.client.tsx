"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { CreativeDraftListItem } from "@/lib/creatives/types";
import { cleanCreativeDisplayName, creativeCardTitle } from "@/lib/creatives/clean-display-name";
import {
  classifyTikTokRejectReasons,
  clientFixAction,
  extractPrimaryRejectReason,
} from "@/lib/creatives/tiktok-reject-action";
import { parseRejectRecommendation } from "@/lib/creatives/reject-recommendation";
import { Button } from "@/components/ui/Button";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { CreativeMediaTile } from "@/features/creative-analyzer/components/CreativeMediaTile";
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
  return creativeCardTitle({
    adName: d.brief.adName,
    campaignName: d.brief.campaignName,
    assetName: d.assetName,
    adText: d.brief.adText,
  });
}

function formatDraftWhen(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  expectDiscoverRefresh = false,
}: {
  drafts: CreativeDraftListItem[];
  publishEnabled: boolean;
  /** Una sola refresh diferida si hay advertisers y aún no hay rechazos TikTok. */
  expectDiscoverRefresh?: boolean;
}) {
  const t = useTranslations("creatives.drafts");
  const locale = useLocale();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const softRefreshDone = useRef(false);

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

  useEffect(() => {
    if (!expectDiscoverRefresh) return;
    if (softRefreshDone.current) return;
    const missingHint = drafts.some(
      (d) =>
        isRejected(d) &&
        (!d.rejectFixHint ||
          !String(d.rejectFixHint).includes('"plan"') ||
          /Modifica el producto o servicio/i.test(String(d.rejectFixHint))),
    );
    const missingMedia = drafts.some(
      (d) => isRejected(d) && !d.previewUrl && !d.posterUrl,
    );
    const thinReasons = drafts.some(
      (d) =>
        isRejected(d) &&
        d.tiktokRejectReasons.every((r) =>
          /no dejó el motivo|material no disponible|problema de revisión/i.test(
            r,
          ),
        ),
    );
    if (
      counts.rejected > 0 &&
      !missingHint &&
      !missingMedia &&
      !thinReasons
    )
      return;
    if (typeof window === "undefined") return;
    const storageKey =
      counts.rejected === 0
        ? "creatives:discover-soft-refresh"
        : thinReasons
          ? "creatives:reasons-soft-refresh"
          : missingHint
            ? "creatives:hint-soft-refresh"
            : "creatives:media-soft-refresh";
    try {
      if (sessionStorage.getItem(storageKey) === "1") {
        softRefreshDone.current = true;
        return;
      }
    } catch {
      /* private mode */
    }
    softRefreshDone.current = true;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        /* ignore */
      }
      router.refresh();
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [expectDiscoverRefresh, counts.rejected, drafts, router]);

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

  async function onAppeal(draftId: string, reason: string) {
    setBusyId(draftId);
    setError(null);
    setMessage(null);
    try {
      await apiClient<{ ok: boolean }>("/api/creative-drafts/appeal", {
        method: "POST",
        body: JSON.stringify({
          draftId,
          reason,
        }),
      });
      setMessage(t("appealSent"));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : t("appealError"),
      );
    } finally {
      setBusyId(null);
    }
  }

  const panelTitle =
    counts.rejected > 0 ? t("titleRecent") : t("title");
  const panelSubtitle =
    counts.rejected > 0
      ? t("subtitleRecent")
      : publishEnabled
        ? t("subtitleEnabled")
        : t("subtitleDisabled");

  const showFilters =
    counts.rejected === 0 && (counts.ready > 0 || activeFilter !== "action");
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

      {drafts.length > 0 && showFilters ? (
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
        <ul className={cn("grid gap-3 p-3 sm:p-4", counts.rejected > 1 ? "lg:grid-cols-2" : null)}>
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
              const recommended = parseRejectRecommendation(draft.rejectFixHint);
              const whyLines = draft.tiktokRejectReasons
                .map((reason) =>
                  reason
                    .replace(/\(\s*UNAVAILABLE\s*\)/gi, "")
                    .replace(/\bUNAVAILABLE\b/gi, "")
                    .replace(/\s+/g, " ")
                    .trim(),
                )
                .filter((reason) => reason.length > 12)
                .slice(0, 3);
              const whyPrimary =
                extractPrimaryRejectReason(draft.tiktokRejectReasons) ||
                t(`simpleReason_${actionKind}`);
              const description = draft.brief.adText.trim();
              const canUpload = clientFixAction(actionKind) !== "fix_page";
              const howto =
                recommended?.plan || t(`fixHint_${actionKind}`);
              const suggestedAd =
                recommended?.adText &&
                !/Video\s*\d+/i.test(recommended.adText)
                  ? recommended.adText
                  : null;
              const appealCopy = recommended?.appeal?.trim() || null;
              const weightBan = /p[eé]rdida de peso|bajar de peso|weight|grasa|metabolismo|sector prohibido|suplement/i.test(
                draft.tiktokRejectReasons.join(" "),
              );
              const appealStatus = (draft.appealStatus || "").toUpperCase();
              const canAppeal =
                Boolean(draft.externalAdId) &&
                Boolean(appealCopy) &&
                !weightBan &&
                (appealStatus === "NOT_APPEALED" || appealStatus === "");
              const appealing = /APPEALING|IN_APPEAL|PENDING/i.test(
                appealStatus,
              );
              const whyUnique = whyLines.filter(
                (line, index) =>
                  whyLines.findIndex(
                    (other) => other.slice(0, 60) === line.slice(0, 60),
                  ) === index,
              );
              return (
                <li
                  key={draft.id}
                  className="flex flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-[#efe4da]"
                >
                  <div className="flex gap-3.5 p-4">
                    <CreativeMediaTile
                      previewUrl={draft.previewUrl}
                      posterUrl={draft.posterUrl}
                      mediaKind={
                        draft.mediaKind ??
                        (draft.posterUrl && !draft.previewUrl
                          ? "image"
                          : draft.previewUrl
                            ? "video"
                            : null)
                      }
                      label={title}
                      playLabel={t("playVideo")}
                      closeLabel={t("closeVideo")}
                      emptyLabel={
                        draft.posterUrl || draft.previewUrl
                          ? undefined
                          : actionKind === "media_invalid"
                            ? t("mediaGone")
                            : t("noPreview")
                      }
                      size="poster"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf0f0] px-2 py-0.5 text-[11px] font-semibold text-[#a23b3b]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#d46a6a]" aria-hidden />
                        {t("tiktokRejected")}
                      </span>
                      <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold tracking-[-0.02em] text-[#1a1714]">
                        {title}
                      </p>
                      {draft.accountName || draft.publishedAt || draft.createdAt ? (
                        <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[#8a8177]">
                          {[
                            draft.accountName,
                            formatDraftWhen(
                              draft.publishedAt || draft.createdAt,
                              locale,
                            ),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}

                    </div>
                  </div>
                  <div className="mx-4 mb-4 rounded-[14px] bg-[#fff8f2] px-3 py-2.5 ring-1 ring-[#f6e3d3]">
                    <p className="text-[11px] font-semibold text-[#9a5a32]">
                      {t("howtoLabel")}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-5 text-[#1a1714]">
                      {howto}
                    </p>
                    {recommended?.videoFix ? (
                      <p className="mt-1.5 text-[12.5px] leading-5 text-[#5c564e]">
                        <span className="font-semibold text-[#1a1714]">
                          {t("videoFixLabel")}:
                        </span>{" "}
                        {recommended.videoFix}
                      </p>
                    ) : null}
                    {recommended?.editFocus ? (
                      <span className="mt-2 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#9a5a32] ring-1 ring-[#f0dccb]">
                        {t(`editFocus_${recommended.editFocus}`)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto space-y-3 border-t border-[#f3ece5] px-4 py-3">
                    {draft.hasActiveFix ? (
                      <p className="rounded-[12px] bg-[#eef7f1] px-3 py-2 text-[12px] font-semibold text-[#2f6b47]">
                        {t("fixInProgress")}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {canUpload ? (
                          <Link
                            href={`?fixDraft=${encodeURIComponent(draft.id)}${
                              draft.adAccountId
                                ? `&fixAccount=${encodeURIComponent(draft.adAccountId)}`
                                : ""
                            }&fixLabel=${encodeURIComponent(title)}&fixKind=${encodeURIComponent(actionKind)}#creative-upload`}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-[#c46d3c] px-4 text-[13px] font-semibold text-white transition hover:bg-[#b0602f]"
                          >
                            {t("uploadFixed")}
                          </Link>
                        ) : (
                          <p className="text-[12px] font-semibold leading-4 text-[#1a1714]">
                            {t("ctaPage")}
                          </p>
                        )}
                        {appealing ? (
                          <span className="text-[12px] font-medium text-[#5c564e]">
                            {t("appealPending")}
                          </span>
                        ) : canAppeal && appealCopy ? (
                          <button
                            type="button"
                            disabled={busyId === draft.id}
                            onClick={() => {
                              const ok = window.confirm(
                                `${t("appealConfirmTitle")}\n\n${appealCopy}\n\n${t("appealConfirmBody")}`,
                              );
                              if (ok) void onAppeal(draft.id, appealCopy);
                            }}
                            className="text-[12px] font-semibold text-[#5c564e] underline-offset-2 hover:underline disabled:opacity-60"
                          >
                            {t("ctaAppeal")}
                          </button>
                        ) : null}
                      </div>
                    )}

                    <details className="group rounded-[12px] bg-[#faf8f5] px-3 py-2">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-[#5c564e] [&::-webkit-details-marker]:hidden">
                        {t("tiktokRejectReasonsLabel")}
                        <span aria-hidden className="text-[#a89c90] transition group-open:rotate-180">⌄</span>
                      </summary>
                      <div className="mt-2 space-y-2 text-[12.5px] leading-5 text-[#5c564e]">
                        {whyUnique.length > 0 ? (
                          whyUnique.map((line) => (
                            <p key={line.slice(0, 64)}>
                              {line.length > 260 ? `${line.slice(0, 257).trim()}…` : line}
                            </p>
                          ))
                        ) : (
                          <p>{whyPrimary}</p>
                        )}
                        {recommended?.quote ? (
                          <p>
                            <span className="font-semibold text-[#1a1714]">{t("videoSaysLabel")}:</span>{" "}
                            “{recommended.quote}”
                          </p>
                        ) : null}
                        {suggestedAd ? (
                          <p>
                            <span className="font-semibold text-[#1a1714]">{t("aiAdTextLabel")}:</span>{" "}
                            “{suggestedAd}”
                          </p>
                        ) : null}
                        <p>
                          <span className="font-semibold text-[#1a1714]">{t("descLabel")}:</span>{" "}
                          {description || t("noAdText")}
                        </p>
                        {weightBan || actionKind === "claims" || actionKind === "policy" ? (
                          <p className="text-[11.5px] text-[#8a8177]">{t("appealHintWeak")}</p>
                        ) : null}
                      </div>
                    </details>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={draft.id}
                className={cn(
                  "overflow-hidden rounded-[1.1rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_8px_20px_rgb(20_18_16_/_0.03)]",
                  failed ? "bg-[#fdf8f7]" : null,
                )}
              >
                <div className="px-4 py-3 sm:px-5">
                  <div className="flex gap-3">
                    <CreativeMediaTile
                      previewUrl={draft.previewUrl}
                      posterUrl={draft.posterUrl}
                      mediaKind={
                        draft.mediaKind ?? (draft.previewUrl ? "video" : null)
                      }
                      label={title}
                      playLabel={t("playVideo")}
                      closeLabel={t("closeVideo")}
                      size="row"
                    />
                    <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                      {title}
                    </p>
                    <span className="rounded-md bg-[rgb(20_18_16_/_0.05)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-text-muted)]">
                      {failed
                        ? t("statusFailed")
                        : draft.status === "approved"
                          ? t("statusApproved")
                          : draft.status === "published"
                            ? t("statusPublished")
                            : t("statusDraft")}
                    </span>
                  </div>
                  {draft.parentDraftId ? (
                    <p className="mt-1 text-[11px] font-medium text-[var(--auth-accent)]">
                      {t("fixOf", {
                        name: cleanCreativeDisplayName(
                          draft.parentLabel || t("briefFallback"),
                        ),
                      })}
                    </p>
                  ) : null}
                  {failed && draft.errorMessage ? (
                    <p className="mt-2 text-[12px] text-[#991b1b]">
                      {draft.errorMessage}
                    </p>
                  ) : null}
                  {draft.brief.notes.find((n) => n.startsWith("SAME_FAIL:")) ? (
                    <p className="mt-2 rounded-lg bg-[#fdf6f5] px-3 py-2 text-[12px] font-medium leading-4 text-[#9b2c2c]">
                      {draft.brief.notes
                        .find((n) => n.startsWith("SAME_FAIL:"))
                        ?.replace(/^SAME_FAIL:\s*/, "")}
                    </p>
                  ) : null}
                  {!isDiscovered && draft.brief.hookCopy ? (
                    <p className="mt-1.5 line-clamp-2 text-[12px] text-[var(--auth-text-muted)]">
                      {draft.brief.hookCopy}
                    </p>
                  ) : null}
                    </div>
                  </div>
                </div>

                {canSend ? (
                  <div className="flex flex-col gap-2 border-t border-[rgb(20_18_16_/_0.06)] px-4 py-3 sm:flex-row sm:px-5">
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
