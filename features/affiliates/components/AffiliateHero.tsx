"use client";

import { useState } from "react";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import type { AffiliateProgramOverview } from "@/types/affiliate";

interface AffiliateHeroProps {
  data: AffiliateProgramOverview;
}

export function AffiliateHero({ data }: AffiliateHeroProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function scrollToMilestones() {
    document.getElementById("affiliate-milestones")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  return (
    <div className="dashboard-surface-card relative min-h-[240px] overflow-hidden rounded-2xl sm:min-h-[280px] lg:min-h-[300px]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#ff781f,#ffa12c)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--auth-accent)]/[0.08] blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-6 p-5 pl-6 sm:gap-8 sm:p-7 sm:pl-8 lg:flex-row lg:items-center lg:justify-between lg:p-8 lg:pl-9">
        <div className="min-w-0 max-w-xl">
          <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]">
            Referidos
          </p>
          <h2 className="mt-2 text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2rem] lg:text-[2.15rem]">
            Programa de afiliados de {siteConfig.companyName}
          </h2>
          <p className="mt-3 max-w-lg text-[15px] font-medium leading-7 text-[var(--auth-text-muted)]">
            Invita anunciantes, comparte tu enlace y gana comisiones por cada
            referido activo.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
            >
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </button>
            <button
              type="button"
              onClick={scrollToMilestones}
              className="inline-flex h-11 items-center rounded-xl border border-[var(--auth-control-border)] bg-white px-5 text-[14px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)]"
            >
              Ver hitos
            </button>
          </div>
        </div>

        <div className="hidden shrink-0 space-y-3 lg:block">
          {[
            {
              label: "Referidos activos",
              value: formatNumber(data.stats.activeReferrals),
            },
            {
              label: "Comisión estimada",
              value: formatMoney(data.stats.estimatedCommission),
            },
            { label: "Comisión máxima", value: "Hasta 12%" },
          ].map((item, i) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-3 shadow-sm"
              style={{ marginLeft: `${i * 10}px` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9a9187]">
                {item.label}
              </p>
              <p className="mt-0.5 text-lg font-semibold text-[#141210]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
