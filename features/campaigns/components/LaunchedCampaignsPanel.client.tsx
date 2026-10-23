"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { LaunchSummary } from "@/lib/campaigns/launch-actions.server";
import type { LaunchAction } from "@/lib/campaigns/launch-optimizer";
import { AddVideosPicker } from "@/features/campaigns/components/AddVideosPicker.client";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const KIND_TONE: Record<LaunchAction["kind"], string> = {
  pause_video: "bg-[#fef2f2] text-[#991b1b]",
  raise_budget: "bg-[#ecf7f0] text-[#1f5c40]",
  new_video: "bg-amber-50 text-amber-900",
  all_losing: "bg-[#fef2f2] text-[#991b1b]",
};

type Action = LaunchSummary["actions"][number];

/** Sugerencias que se resuelven sumando videos nuevos a la campaña. */
const NEEDS_VIDEOS = new Set<LaunchAction["kind"]>(["new_video", "all_losing"]);

async function fetchLaunches(): Promise<LaunchSummary[]> {
  const response = await fetch("/api/campaigns/actions");
  const data = (await response.json()) as { launches?: LaunchSummary[]; error?: string };
  if (!response.ok) throw new Error(data.error);
  return data.launches ?? [];
}

/** Campañas lanzadas desde Ads Holistic con las sugerencias del día para aprobar o descartar. */
export function LaunchedCampaignsPanel() {
  const t = useTranslations("creatives.launched");
  const [launches, setLaunches] = useState<LaunchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  /** Selector de videos abierto: para la campaña o para resolver una sugerencia. */
  const [picker, setPicker] = useState<{ launchId: string; actionId: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLaunches()
      .then((list) => {
        if (!cancelled) setLaunches(list);
      })
      .catch(() => {
        if (!cancelled) setError(t("errors.load"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function decide(action: Action, decision: "apply" | "dismiss", videoIds?: string[]) {
    setBusy(action.id);
    setNotice(null);
    try {
      const response = await fetch("/api/campaigns/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: action.id, decision, videoIds }),
      });
      const data = (await response.json()) as { ok: boolean; status?: string; message?: string; error?: string };
      setNotice({
        id: action.id,
        ok: data.ok,
        text: data.ok
          ? t(decision === "dismiss" ? "done.dismissed" : videoIds?.length ? "done.videosAdded" : NEEDS_VIDEOS.has(action.kind) ? "done.handled" : "done.applied")
          : (data.message ?? data.error ?? t("errors.decide")),
      });
      if (data.ok) {
        setPicker(null);
        setLaunches(await fetchLaunches());
      }
    } catch {
      setNotice({ id: action.id, ok: false, text: t("errors.decide") });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function addVideos(launchId: string, videoIds: string[]) {
    setNotice(null);
    try {
      const response = await fetch("/api/campaigns/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchId, videoIds }),
      });
      const data = (await response.json()) as { ok: boolean; added?: string[]; message?: string; error?: string };
      setNotice({
        id: launchId,
        ok: data.ok,
        text: data.ok ? t("addVideos.done", { count: data.added?.length ?? 0 }) : (data.message ?? data.error ?? t("errors.decide")),
      });
      if (data.ok) setPicker(null);
    } catch {
      setNotice({ id: launchId, ok: false, text: t("errors.decide") });
    }
  }

  function describe(p: LaunchAction): string {
    switch (p.kind) {
      case "pause_video":
        return p.costPerResult === null
          ? t("describe.pauseNoSales", { video: p.videoName, spend: usd.format(p.spend), avg: usd.format(p.campaignCostPerResult) })
          : t("describe.pause", { video: p.videoName, cpr: usd.format(p.costPerResult), avg: usd.format(p.campaignCostPerResult) });
      case "raise_budget":
        return t("describe.raise", {
          from: usd.format(p.fromBudget),
          to: usd.format(p.toBudget),
          cpr: usd.format(p.costPerResult),
          avg: usd.format(p.clientCostPerResult),
          pct: p.cheaperPct,
        });
      case "new_video":
        return t("describe.newVideo", { video: p.videoName, pct: p.ctrDropPct });
      case "all_losing":
        return t("describe.allLosing", { count: p.losers });
    }
  }

  return (
    <section
      id="launched-campaigns"
      className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">{t("kicker")}</p>
        <h2 className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">{t("title")}</h2>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">{t("subtitle")}</p>
      </div>

      <div className="px-5 py-4 sm:px-6 sm:py-5">
        {error ? (
          <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]">{error}</p>
        ) : launches === null ? (
          <p className="text-[13px] text-[var(--auth-text-muted)]">{t("loading")}</p>
        ) : launches.length === 0 ? (
          <p className="text-[13px] text-[var(--auth-text-muted)]">{t("empty")}</p>
        ) : (
          <ul className="space-y-4">
            {launches.map((launch) => {
              const pending = launch.actions.filter((a) => a.status === "suggested");
              const history = launch.actions.filter((a) => a.status !== "suggested").slice(0, 3);
              return (
                <li key={launch.id} className="rounded-[1.1rem] border border-[rgb(20_18_16_/_0.08)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[var(--auth-text)]" title={launch.campaignName}>
                        {launch.campaignName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--auth-text-muted)]">
                        {t("meta", {
                          budget: usd.format(launch.dailyBudget),
                          date: new Date(launch.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
                        })}
                        {" · "}
                        {t(`mode.${launch.optimizeMode}`)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setPicker({ launchId: launch.id, actionId: null })}
                        className="text-[12px] font-semibold text-[var(--auth-accent)] underline-offset-2 hover:underline"
                      >
                        {t("addVideos.open")}
                      </button>
                      <a
                        href={`https://ads.tiktok.com/i18n/perf/campaign?aadvid=${launch.advertiserId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-semibold text-[var(--auth-text)] underline-offset-2 hover:underline"
                      >
                        {t("openAdsManager")}
                      </a>
                    </div>
                  </div>

                  {notice?.id === launch.id ? (
                    <p className={cn("mt-2 rounded-lg px-2.5 py-1.5 text-[12px]", notice.ok ? "bg-[#ecf7f0] text-[#1f5c40]" : "bg-[#fef2f2] text-[#991b1b]")}>
                      {notice.text}
                    </p>
                  ) : null}
                  {picker?.launchId === launch.id && picker.actionId === null ? (
                    <AddVideosPicker
                      launchId={launch.id}
                      onSubmit={(videoIds) => addVideos(launch.id, videoIds)}
                      onCancel={() => setPicker(null)}
                    />
                  ) : null}

                  {pending.length === 0 ? (
                    <p className="mt-3 text-[12px] text-[var(--auth-text-muted)]">{t("noPending")}</p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {pending.map((action) => (
                        <li key={action.id} className="rounded-xl bg-[rgb(255_248_243_/_0.7)] p-3">
                          <span className={cn("inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]", KIND_TONE[action.kind])}>
                            {t(`kind.${action.kind}`)}
                          </span>
                          <p className="mt-1.5 text-[13px] leading-5 text-[var(--auth-text)]">{describe(action.payload)}</p>
                          {notice?.id === action.id ? (
                            <p className={cn("mt-2 rounded-lg px-2.5 py-1.5 text-[12px]", notice.ok ? "bg-[#ecf7f0] text-[#1f5c40]" : "bg-[#fef2f2] text-[#991b1b]")}>
                              {notice.text}
                            </p>
                          ) : null}
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {confirming === action.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => void decide(action, "apply")}
                                  className="h-9 rounded-xl bg-[var(--auth-accent)] px-3.5 text-[12px] font-bold text-white disabled:opacity-60"
                                >
                                  {busy === action.id ? t("applying") : t(`confirm.${action.kind}`)}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => setConfirming(null)}
                                  className="h-9 rounded-xl border border-[rgb(20_18_16_/_0.12)] px-3.5 text-[12px] font-semibold text-[var(--auth-text)]"
                                >
                                  {t("cancel")}
                                </button>
                              </>
                            ) : (
                              <>
                                {NEEDS_VIDEOS.has(action.kind) ? (
                                  <button
                                    type="button"
                                    disabled={busy !== null}
                                    onClick={() => setPicker({ launchId: launch.id, actionId: action.id })}
                                    className="h-9 rounded-xl bg-[var(--auth-accent)] px-3.5 text-[12px] font-bold text-white disabled:opacity-60"
                                  >
                                    {t("addVideos.fromSuggestion")}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => setConfirming(action.id)}
                                  className="h-9 rounded-xl bg-[var(--auth-text)] px-3.5 text-[12px] font-bold text-white disabled:opacity-60"
                                >
                                  {t(`apply.${action.kind}`)}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => void decide(action, "dismiss")}
                                  className="h-9 rounded-xl border border-[rgb(20_18_16_/_0.12)] px-3.5 text-[12px] font-semibold text-[var(--auth-text-muted)]"
                                >
                                  {t("dismiss")}
                                </button>
                              </>
                            )}
                          </div>
                          {picker?.actionId === action.id ? (
                            <AddVideosPicker
                              launchId={launch.id}
                              onSubmit={(videoIds) => decide(action, "apply", videoIds)}
                              onCancel={() => setPicker(null)}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {history.length > 0 ? (
                    <ul className="mt-3 space-y-1 border-t border-[var(--auth-divider)] pt-2.5">
                      {history.map((action) => (
                        <li key={action.id} className="text-[11px] text-[var(--auth-text-muted)]">
                          <span className={cn("font-semibold", action.status === "failed" ? "text-[#991b1b]" : "text-[#1f5c40]")}>
                            {t(`status.${action.status as "applied" | "failed" | "dismissed"}`)}
                          </span>
                          {" · "}
                          {t(`kind.${action.kind}`)}
                          {action.error ? ` · ${action.error}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
