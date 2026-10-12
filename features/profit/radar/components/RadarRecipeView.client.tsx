"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { routes } from "@/config/routes";
import type { StoredRecipe } from "@/lib/radar/recipe.server";
import type { RadarScript } from "@/lib/radar/recipe-parse";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

function usd(value: number) {
  return `$${value.toFixed(2)}`;
}

function Label({ children }: { children: React.ReactNode }) {
  return <dt className="text-[12.5px] font-semibold text-[#8a8177]">{children}</dt>;
}

type CopyLabels = { show: string; say: string; onScreen: string; hooks: string; caption: string; tips: string };

function scriptAsText(script: RadarScript, labels: CopyLabels): string {
  const lines = [
    script.title,
    "",
    `"${script.hook}"`,
    script.whoAppears ? `(${script.whoAppears})` : "",
    "",
    ...script.beats.flatMap((b) => [
      b.seconds,
      `  ${labels.show}: ${b.shot}`,
      `  ${labels.say}: ${b.line}`,
      b.onScreen ? `  ${labels.onScreen}: ${b.onScreen}` : "",
    ]),
    "",
    ...script.onScreenText.map((t) => `• ${t}`),
    script.cta,
    "",
    script.hookAlternatives.length > 0 ? `${labels.hooks}:` : "",
    ...script.hookAlternatives.map((h) => `• ${h}`),
    "",
    script.caption ? `${labels.caption}: ${script.caption} ${script.hashtags.join(" ")}`.trim() : "",
    "",
    script.tips.length > 0 ? `${labels.tips}:` : "",
    ...script.tips.map((tip) => `• ${tip}`),
  ];
  return lines.filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n").trim();
}

function ScriptCard({ script, index }: { script: RadarScript; index: number }) {
  const t = useTranslations("profit.radar.recipe");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const headingId = `radar-script-${index}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        scriptAsText(script, {
          show: t("show"),
          say: t("say"),
          onScreen: t("onScreenBeat"),
          hooks: t("hookAlternatives"),
          caption: t("caption"),
          tips: t("tips"),
        }),
      );
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <article aria-labelledby={headingId} className="rounded-[16px] border border-[#ece7e0] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="text-[15.5px] font-bold tracking-[-0.01em] text-[#1c1917]">
            {script.title}
          </h3>
          {script.whoAppears || script.durationSeconds ? (
            <p className="mt-0.5 text-[13px] text-[#8a8177]">
              {[
                script.whoAppears ? t("who", { who: script.whoAppears }) : null,
                script.durationSeconds ? t("durationValue", { seconds: script.durationSeconds }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className={`inline-flex h-9 items-center rounded-[10px] border border-[#e0d9d0] bg-white px-3 text-[13px] font-semibold text-[#1c1917] transition-colors hover:border-[#cfc6bb] ${focusRing}`}
        >
          {copyState === "copied" ? t("copied") : t("copy")}
        </button>
      </div>
      {copyState === "failed" ? (
        <p role="status" className="mt-2 text-[12.5px] text-[#b45309]">
          {t("copyFailed")}
        </p>
      ) : null}

      <p className="mt-3 text-[17px] font-semibold leading-[1.45] text-[#1c1917] [text-wrap:balance]">
        “{script.hook}”
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-[#ece7e0] text-[12px] text-[#8a8177]">
              <th scope="col" className="w-[68px] py-2 pr-3 font-semibold" />
              <th scope="col" className="w-[34%] py-2 pr-3 font-semibold">{t("show")}</th>
              <th scope="col" className="py-2 font-semibold">{t("say")}</th>
            </tr>
          </thead>
          <tbody>
            {script.beats.map((beat, i) => (
              <tr key={i} className="border-b border-[#f3efe9] align-top last:border-0">
                <td className="py-2.5 pr-3 font-semibold tabular-nums text-[#8a8177]">{beat.seconds}</td>
                <td className="py-2.5 pr-3 text-[#5c564e]">
                  {beat.shot}
                  {beat.onScreen ? (
                    <span className="mt-1.5 block w-fit rounded-[8px] bg-[#f5f2ed] px-2 py-0.5 text-[12.5px] font-semibold text-[#1c1917]">
                      {beat.onScreen}
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 leading-[1.55] text-[#1c1917]">{beat.line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {script.onScreenText.length > 0 || script.cta ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {script.onScreenText.map((text) => (
            <span key={text} className="rounded-[8px] bg-[#f5f2ed] px-2.5 py-1 text-[12.5px] font-semibold text-[#1c1917]">
              {text}
            </span>
          ))}
          {script.cta ? <span className="text-[13px] text-[#5c564e]">→ {script.cta}</span> : null}
        </div>
      ) : null}

      {script.hookAlternatives.length > 0 || script.caption || script.tips.length > 0 ? (
        <dl className="mt-4 grid gap-x-6 gap-y-4 border-t border-[#f3efe9] pt-4 sm:grid-cols-2">
          {script.hookAlternatives.length > 0 ? (
            <div>
              <Label>{t("hookAlternatives")}</Label>
              <dd className="mt-1.5">
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13.5px] leading-[1.55] text-[#1c1917] marker:text-[#cfc6bb]">
                  {script.hookAlternatives.map((h) => (
                    <li key={h}>“{h}”</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {script.tips.length > 0 ? (
            <div>
              <Label>{t("tips")}</Label>
              <dd className="mt-1.5">
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13.5px] leading-[1.55] text-[#5c564e] marker:text-[#cfc6bb]">
                  {script.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {script.caption ? (
            <div className="sm:col-span-2">
              <Label>{t("caption")}</Label>
              <dd className="mt-1 text-[13.5px] leading-[1.55] text-[#1c1917]">
                {script.caption}
                {script.hashtags.length > 0 ? (
                  <span className="ml-1 text-[#8a8177]">{script.hashtags.join(" ")}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}

/** La receta única del cliente: ingredientes, referencia del rubro y tres guiones. */
export function RadarRecipeView({ stored }: { stored: StoredRecipe }) {
  const t = useTranslations("profit.radar.recipe");
  const { recipe, benchmark } = stored;
  const cpr = benchmark?.costPerResult ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[18px] rounded-tl-[6px] border border-[#ece7e0] bg-white px-4 py-5 sm:px-6">
        <h2 className="text-[1.2rem] font-bold leading-tight tracking-[-0.02em] text-[#1c1917] [text-wrap:balance]">
          {stored.product ? t("title", { product: stored.product }) : t("titleNoProduct")}
        </h2>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.6] text-[#1c1917]">{recipe.summary}</p>
        {cpr ? (
          <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.55] text-[#5c564e]">
            {t("benchmark", { low: usd(cpr.p25), high: usd(cpr.p75), accounts: benchmark!.accounts })}
          </p>
        ) : null}

        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>{t("hook")}</Label>
            <dd className="mt-1">
              <span className="text-[16px] font-semibold text-[#1c1917]">“{recipe.hook.example}”</span>
              {recipe.hook.type ? <span className="ml-2 text-[13px] text-[#8a8177]">{recipe.hook.type}</span> : null}
              {recipe.hook.why ? <p className="mt-1 text-[13.5px] leading-[1.55] text-[#5c564e]">{recipe.hook.why}</p> : null}
            </dd>
          </div>
          {recipe.format ? (
            <div>
              <Label>{t("format")}</Label>
              <dd className="mt-1 text-[14.5px] text-[#1c1917]">{recipe.format}</dd>
            </div>
          ) : null}
          {recipe.durationSeconds ? (
            <div>
              <Label>{t("duration")}</Label>
              <dd className="mt-1 text-[14.5px] tabular-nums text-[#1c1917]">
                {t("durationValue", { seconds: recipe.durationSeconds })}
              </dd>
            </div>
          ) : null}
          {recipe.cta ? (
            <div>
              <Label>{t("cta")}</Label>
              <dd className="mt-1 text-[14.5px] text-[#1c1917]">{recipe.cta}</dd>
            </div>
          ) : null}
          {recipe.onScreenText.length > 0 ? (
            <div>
              <Label>{t("onScreen")}</Label>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {recipe.onScreenText.map((text) => (
                  <span key={text} className="rounded-[8px] bg-[#f5f2ed] px-2.5 py-1 text-[13px] font-semibold text-[#1c1917]">
                    {text}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Label>{t("structure")}</Label>
            <dd className="mt-2">
              <ol className="flex flex-col">
                {recipe.structure.map((beat, i) => (
                  <li key={i} className="grid grid-cols-[72px_1fr] gap-3 border-t border-[#f3efe9] py-2 text-[14px] first:border-0">
                    <span className="font-semibold tabular-nums text-[#8a8177]">{beat.seconds}</span>
                    <span className="text-[#1c1917]">{beat.beat}</span>
                  </li>
                ))}
              </ol>
            </dd>
          </div>
          {recipe.why.length > 0 ? (
            <div>
              <Label>{t("why")}</Label>
              <dd className="mt-1.5">
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13.5px] leading-[1.55] text-[#5c564e] marker:text-[#cfc6bb]">
                  {recipe.why.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {recipe.avoid.length > 0 ? (
            <div>
              <Label>{t("avoid")}</Label>
              <dd className="mt-1.5">
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[13.5px] leading-[1.55] text-[#5c564e] marker:text-[#cfc6bb]">
                  {recipe.avoid.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {stored.scripts.length > 0 ? (
        <section aria-label={t("scripts")} className="flex flex-col gap-3">
          <h2 className="pl-1 text-[15px] font-bold text-[#1c1917]">{t("scripts")}</h2>
          {stored.scripts.map((script, i) => (
            <ScriptCard key={`${stored.id}-${i}`} script={script} index={i} />
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 pl-1">
            <p className="text-[12.5px] text-[#8a8177]">{t("original")}</p>
            <Link
              href={routes.creativeAnalyzer}
              className={`inline-flex h-10 items-center rounded-[12px] border border-[#e0d9d0] bg-white px-4 text-[13.5px] font-semibold text-[#1c1917] transition-colors hover:border-[#cfc6bb] ${focusRing}`}
            >
              {t("toCreatives")}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
