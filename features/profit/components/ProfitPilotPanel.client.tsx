"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import { moneyUsd } from "@/lib/format/money-usd";
import type { PilotProposal } from "@/lib/radar/pilot";

/**
 * Piloto (Fase 5 del Radar) dentro de Profit: propuestas sobre los anuncios
 * del cliente. Nada cambia hasta que el cliente confirma; la única acción
 * ejecutable es pausar un anuncio que pierde (reversible).
 */

type PilotResponse = {
  proposals: PilotProposal[];
  averageCostPerResult: number | null;
  dataThrough: string | null;
  actionsEnabled: boolean;
  canAct: boolean;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const primaryBtn = `inline-flex h-9 items-center rounded-[10px] bg-[#17150f] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#2b2620] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
const secondaryBtn = `inline-flex h-9 items-center rounded-[10px] border border-[#e0d9d0] bg-white px-3.5 text-[13px] font-semibold text-[#1c1917] transition-colors hover:border-[#cfc6bb] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

const TONE: Record<PilotProposal["kind"], string> = {
  pause_loser_same_group: "bg-[#d97706]",
  pause_loser: "bg-[#d97706]",
  scale_winner: "bg-[#3f9a62]",
  refresh_fatigued: "bg-[#d97706]",
  all_losing: "bg-[#c24c4c]",
};

function money(value: number | null) {
  return value == null ? "—" : moneyUsd(value);
}

export function ProfitPilotPanel() {
  const t = useTranslations("profit.pilot");
  const [data, setData] = useState<PilotResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; text: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profit/pilot", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as PilotResponse;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  async function act(proposal: PilotProposal, action: "pause" | "dismiss", name?: string) {
    setBusy(proposal.id);
    setNotice(null);
    try {
      const res = await fetch("/api/profit/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, action }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || String(res.status));
      setData((prev) => (prev ? { ...prev, proposals: prev.proposals.filter((p) => p.id !== proposal.id) } : prev));
      if (action === "pause" && name) setNotice({ id: proposal.id, text: t("actions.done", { name }), tone: "ok" });
    } catch (error) {
      setNotice({ id: proposal.id, text: error instanceof Error ? error.message : t("error"), tone: "error" });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  // Sin datos guardados todavía, la sección no se muestra.
  if (!loadFailed && data && data.dataThrough == null) return null;

  return (
    <section className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#e8dfd4]" aria-busy={!data && !loadFailed}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0 max-w-[62ch]">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1714]">{t("title")}</h2>
          <p className="mt-0.5 text-[12px] leading-[1.5] text-[#5c564e]">{t("subtitle")}</p>
        </div>
        {data?.averageCostPerResult != null ? (
          <span className="rounded-full bg-[#f3eee8] px-2.5 py-1 text-[11px] font-medium text-[#5c564e]">
            {t("average", { amount: moneyUsd(data.averageCostPerResult) })}
          </span>
        ) : null}
      </div>

      {notice && notice.tone === "ok" ? (
        <p role="status" className="mx-4 mb-3 rounded-[10px] bg-[#eaf5ee] px-3 py-2 text-[13px] text-[#2f6b47] sm:mx-5">
          {notice.text}
        </p>
      ) : null}

      {loadFailed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 px-4 pb-5 text-[13px] text-[#5c564e] sm:px-5">
          {t("error")}
          <button type="button" onClick={() => setReloadToken((n) => n + 1)} className={secondaryBtn}>
            {t("retry")}
          </button>
        </div>
      ) : !data ? (
        <div className="space-y-2 px-4 pb-5 sm:px-5" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-[#f5f2ed] motion-reduce:animate-none" />
          ))}
        </div>
      ) : data.proposals.length === 0 ? (
        <p className="px-4 pb-5 text-[13px] text-[#5c564e] sm:px-5">{t("empty")}</p>
      ) : (
        <ul className="border-t border-[#f0ebe4]">
          {data.proposals.map((p) => {
            const avg = money(p.kind === "all_losing" || p.kind === "refresh_fatigued" ? null : p.averageCostPerResult);
            let title = "";
            let body = "";
            let pauseName: string | null = null;
            let toRadar = false;
            switch (p.kind) {
              case "pause_loser_same_group":
                pauseName = p.loser.adName;
                title = t("kinds.pause_loser_same_group.title", { loser: p.loser.adName });
                body =
                  p.loserCostPerResult == null
                    ? t("kinds.pause_loser_same_group.bodyNoResults", {
                        winner: p.winner.adName,
                        loser: p.loser.adName,
                        winnerCpr: money(p.winnerCostPerResult),
                      })
                    : t("kinds.pause_loser_same_group.body", {
                        winner: p.winner.adName,
                        loser: p.loser.adName,
                        winnerCpr: money(p.winnerCostPerResult),
                        loserCpr: money(p.loserCostPerResult),
                      });
                break;
              case "pause_loser":
                pauseName = p.loser.adName;
                title = t("kinds.pause_loser.title", { loser: p.loser.adName });
                body =
                  p.loserCostPerResult == null
                    ? t("kinds.pause_loser.bodyNoResults", { spend: money(p.loserSpend) })
                    : t("kinds.pause_loser.body", { loserCpr: money(p.loserCostPerResult), avg });
                break;
              case "scale_winner":
                title = t("kinds.scale_winner.title", { winner: p.winner.adName });
                body = t("kinds.scale_winner.body", { pct: p.cheaperPct, max: p.maxIncreasePct });
                break;
              case "refresh_fatigued":
                toRadar = true;
                title = t("kinds.refresh_fatigued.title", { ad: p.ad.adName });
                body = t("kinds.refresh_fatigued.body", { pct: p.ctrDropPct });
                break;
              case "all_losing":
                toRadar = true;
                title = t("kinds.all_losing.title");
                body = t("kinds.all_losing.body");
                break;
            }
            const isConfirming = confirming === p.id;
            const isBusy = busy === p.id;
            return (
              <li key={p.id} className="flex flex-col gap-3 border-b border-[#f3efe9] px-4 py-4 last:border-0 sm:px-5">
                <div className="flex gap-3">
                  <span aria-hidden className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${TONE[p.kind]}`} />
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-[#1c1917] [overflow-wrap:anywhere]">{title}</h3>
                    <p className="mt-0.5 max-w-[68ch] text-[13px] leading-[1.55] text-[#5c564e] [overflow-wrap:anywhere]">{body}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-5">
                  {pauseName && data.canAct && data.actionsEnabled ? (
                    isConfirming ? (
                      <>
                        <span className="text-[12.5px] text-[#5c564e]">{t("actions.confirmText")}</span>
                        <button type="button" className={primaryBtn} disabled={isBusy} onClick={() => void act(p, "pause", pauseName!)}>
                          {t("actions.confirm")}
                        </button>
                        <button type="button" className={secondaryBtn} disabled={isBusy} onClick={() => setConfirming(null)}>
                          {t("actions.cancel")}
                        </button>
                      </>
                    ) : (
                      <button type="button" className={primaryBtn} onClick={() => setConfirming(p.id)}>
                        {t("actions.pause", { name: pauseName })}
                      </button>
                    )
                  ) : null}
                  {toRadar ? (
                    <Link href={`${routes.profit}/radar`} className={secondaryBtn}>
                      {t("actions.toRadar")}
                    </Link>
                  ) : null}
                  {data.canAct && !isConfirming ? (
                    <button type="button" className={`${secondaryBtn} border-transparent text-[#5c564e]`} disabled={isBusy} onClick={() => void act(p, "dismiss")}>
                      {t("actions.dismiss")}
                    </button>
                  ) : null}
                  {pauseName && !data.canAct ? <span className="text-[12px] text-[#8a8177]">{t("actions.viewOnly")}</span> : null}
                  {pauseName && data.canAct && !data.actionsEnabled ? (
                    <span className="text-[12px] text-[#8a8177]">{t("actions.actionsOff")}</span>
                  ) : null}
                </div>
                {notice && notice.id === p.id && notice.tone === "error" ? (
                  <p role="alert" className="ml-5 rounded-[10px] bg-[#fef2f2] px-3 py-2 text-[12.5px] text-[#991b1b]">
                    {notice.text}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-[#f0ebe4] px-4 py-2.5 text-[11.5px] text-[#8a8177] sm:px-5">{t("rules")}</p>
    </section>
  );
}
