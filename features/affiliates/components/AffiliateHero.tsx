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
    <div className="relative min-h-[240px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#7c3aed] via-[#4056ff] to-[#06b6d4] shadow-lg shadow-indigo-500/15 sm:min-h-[280px] sm:rounded-3xl lg:min-h-[320px]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-1/4 top-1/2 h-16 w-16 rounded-full bg-amber-300/30 blur-xl" />
        <div className="absolute bottom-8 left-8 h-12 w-12 rounded-full border border-white/20 bg-white/5" />
        <div className="absolute right-32 top-12 h-8 w-8 rounded-full border border-white/15 bg-white/10" />
        <svg
          className="absolute bottom-0 left-0 w-full opacity-20"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,64 C300,120 600,0 900,48 C1050,72 1150,56 1200,64 L1200,120 L0,120 Z"
            fill="white"
          />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col gap-6 p-5 sm:gap-8 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            Referidos
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2rem] lg:leading-tight">
            Programa de afiliados de {siteConfig.companyName}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
            Invita anunciantes, comparte tu enlace y gana comisiones competitivas
            por cada referido activo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-11 items-center rounded-xl bg-white px-6 text-sm font-semibold text-[#4056ff] shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-lg"
            >
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </button>
            <button
              type="button"
              onClick={scrollToMilestones}
              className="inline-flex h-11 items-center rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20"
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
              className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md"
              style={{ marginLeft: `${i * 12}px` }}
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                {item.label}
              </p>
              <p className="mt-0.5 text-lg font-bold text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 lg:hidden">
          <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
            <span className="text-[10px] text-white/60">Activos</span>
            <span className="ml-2 text-sm font-bold text-white">
              {data.stats.activeReferrals}
            </span>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
            <span className="text-[10px] text-white/60">Comisión</span>
            <span className="ml-2 text-sm font-bold text-white">
              {formatMoney(data.stats.estimatedCommission)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
