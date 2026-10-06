"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { moneyUsd } from "@/lib/format/money-usd";
import {
  buildProductPerformance,
  MIN_SPEND_FOR_VERDICT,
  type ProductCampaignInput,
  type ProductVerdict,
} from "@/lib/realprofit/product-performance";

const VERDICT_TONE: Record<ProductVerdict, { pill: string; dot: string; bar: string }> = {
  scale: { pill: "bg-[#eaf5ee] text-[#2f6b47]", dot: "bg-[#3f9a62]", bar: "bg-[#8fc7a3]" },
  keep: { pill: "bg-[#fff4e5] text-[#9a5a12]", dot: "bg-[#e0a24a]", bar: "bg-[#efc98f]" },
  review: { pill: "bg-[#fdf0f0] text-[#a23b3b]", dot: "bg-[#d46a6a]", bar: "bg-[#eab0b0]" },
  stop: { pill: "bg-[#fdf0f0] text-[#a23b3b]", dot: "bg-[#c24c4c]", bar: "bg-[#e29a9a]" },
  low_data: { pill: "bg-[#f3eee8] text-[#8a8177]", dot: "bg-[#b5aaa0]", bar: "bg-[#e3dbd2]" },
  no_data: { pill: "bg-[#f3eee8] text-[#8a8177]", dot: "bg-[#b5aaa0]", bar: "bg-[#e3dbd2]" },
};

const TOP = 8;

export function ProductPerformancePanel({ campaigns }: { campaigns: ProductCampaignInput[] }) {
  const t = useTranslations("profit.products");
  const [showAll, setShowAll] = useState(false);
  const { rows, averageCostPerResult, hasConversions } = useMemo(
    () => buildProductPerformance(campaigns),
    [campaigns],
  );
  if (rows.length === 0) return null;

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});
  const visible = showAll ? rows : rows.slice(0, TOP);

  const reason = (r: (typeof rows)[number]) => {
    if (r.verdict === "no_data") return t("reason.no_data");
    if (r.verdict === "low_data") return t("reason.low_data", { min: moneyUsd(MIN_SPEND_FOR_VERDICT) });
    if (r.verdict === "stop") return t("reason.stop", { spend: moneyUsd(r.spend) });
    const pct = r.vsAverage != null ? Math.round(Math.abs(1 - r.vsAverage) * 100) : 0;
    if (r.verdict === "scale") return t("reason.scale", { pct });
    if (r.verdict === "review") return t("reason.review", { pct });
    return t("reason.keep");
  };

  return (
    <section className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#e8dfd4]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1714]">{t("title")}</h2>
          <p className="mt-0.5 text-[12px] text-[#5c564e]">{t("subtitle")}</p>
        </div>
        {hasConversions && averageCostPerResult != null ? (
          <span className="rounded-full bg-[#f3eee8] px-2.5 py-1 text-[11px] font-medium text-[#5c564e]">
            {t("average", { amount: moneyUsd(averageCostPerResult) })}
          </span>
        ) : null}
      </div>

      {hasConversions ? (
        <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-5">
          {(["scale", "keep", "review", "stop"] as const).map((v) =>
            counts[v] ? (
              <span key={v} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${VERDICT_TONE[v].pill}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${VERDICT_TONE[v].dot}`} aria-hidden />
                {t(`verdict.${v}`)} · {counts[v]}
              </span>
            ) : null,
          )}
        </div>
      ) : (
        <p className="mx-4 mb-3 rounded-[12px] bg-[#faf8f5] px-3 py-2 text-[12px] text-[#5c564e] sm:mx-5">{t("noConversions")}</p>
      )}

      <ul className="px-4 pb-2 sm:px-5">
        {visible.map((r) => {
          const tone = VERDICT_TONE[r.verdict];
          return (
            <li key={r.product} className="border-t border-[#f1ebe4] py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[13.5px] font-semibold text-[#1a1714]" title={r.campaigns.join("\n")}>
                      {r.product}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
                      {t(`verdict.${r.verdict}`)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-[#8a8177]">
                    {t("campaignsCount", { count: r.campaigns.length })} · {reason(r)}
                  </p>
                </div>
                <dl className="grid shrink-0 grid-cols-3 gap-x-5 text-right">
                  <div>
                    <dt className="text-[10.5px] text-[#8a8177]">{t("spend")}</dt>
                    <dd className="text-[13px] font-semibold tabular-nums text-[#1a1714]">{moneyUsd(r.spend)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] text-[#8a8177]">{t("results")}</dt>
                    <dd className="text-[13px] font-semibold tabular-nums text-[#1a1714]">{r.conversions ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] text-[#8a8177]">{t("costPerResult")}</dt>
                    <dd className="text-[13px] font-semibold tabular-nums text-[#1a1714]">
                      {r.costPerResult != null ? moneyUsd(r.costPerResult) : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f3ece5]">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(2, r.spendShare * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#efe8e0] px-4 py-3 sm:px-5">
        <p className="text-[11.5px] text-[#8a8177]">{t("footnote")}</p>
        {rows.length > TOP ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[12px] font-semibold text-[#1a1714] underline-offset-4 hover:underline"
          >
            {showAll ? t("showLess") : t("showAll", { count: rows.length })}
          </button>
        ) : null}
      </div>
    </section>
  );
}
