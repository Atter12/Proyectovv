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
    <div className="relative min-h-[240px] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0b4f9c_0%,#178bff_52%,#0f7ae5_100%)] shadow-[0_18px_40px_rgb(23_139_255_/_0.22)] sm:min-h-[280px] lg:min-h-[300px]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-[#9af7c9]/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.55) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse 70% 80% at 75% 35%, black, transparent)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col gap-6 p-5 sm:gap-8 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div className="min-w-0 max-w-xl">
          <p className="text-[13px] font-semibold tracking-[0.04em] text-white/80">
            Referidos
          </p>
          <h2 className="font-display mt-2 text-[1.75rem] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-[2rem] lg:text-[2.15rem]">
            Programa de afiliados de {siteConfig.companyName}
          </h2>
          <p className="mt-3 max-w-lg text-[15px] leading-7 text-white/85">
            Invita anunciantes, comparte tu enlace y gana comisiones por cada
            referido activo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-11 items-center rounded-xl bg-white px-5 text-[14px] font-semibold text-[var(--brand-primary)] shadow-md transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg"
            >
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </button>
            <button
              type="button"
              onClick={scrollToMilestones}
              className="inline-flex h-11 items-center rounded-xl border border-white/30 bg-white/10 px-5 text-[14px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
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
              className="rounded-xl border border-white/20 bg-white/12 px-5 py-3 backdrop-blur-md"
              style={{ marginLeft: `${i * 10}px` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/65">
                {item.label}
              </p>
              <p className="mt-0.5 text-lg font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 lg:hidden">
          <div className="rounded-xl border border-white/20 bg-white/12 px-3 py-2 backdrop-blur-sm">
            <span className="text-[11px] text-white/70">Activos</span>
            <span className="ml-2 text-sm font-semibold text-white">
              {data.stats.activeReferrals}
            </span>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/12 px-3 py-2 backdrop-blur-sm">
            <span className="text-[11px] text-white/70">Comisión</span>
            <span className="ml-2 text-sm font-semibold text-white">
              {formatMoney(data.stats.estimatedCommission)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
