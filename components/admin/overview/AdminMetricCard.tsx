"use client";

import { useState } from "react";
import { KPI_CARD_BACKGROUNDS } from "./kpiCardBackgrounds";

export type AdminMetricAccent = "indigo" | "emerald" | "amber" | "rose";

const accentStyles: Record<
  AdminMetricAccent,
  {
    border: string;
    stripe: string;
    icon: string;
    label: string;
    detail: string;
    overlay: string;
    symbol: string;
    fallback: string;
  }
> = {
  indigo: {
    border: "border-[#b8dce8]/80",
    stripe: "bg-[#0e7490]",
    icon: "bg-[#0e7490]/14 text-[#0e7490] ring-[#bfe4ee]/90 backdrop-blur-sm",
    label: "text-[#1a6578]",
    detail: "text-[#3d5f6f]",
    overlay:
      "bg-[linear-gradient(135deg,rgba(247,252,254,0.08)_0%,rgba(236,247,251,0.08)_52%,rgba(228,242,248,0.08)_100%)]",
    symbol: "Org",
    fallback: "bg-[linear-gradient(135deg,#f7fcfe_0%,#eef7fb_100%)]",
  },
  emerald: {
    border: "border-[#b5e5d4]/80",
    stripe: "bg-[#59c493]",
    icon: "bg-[#59c493]/14 text-[#1a8f6e] ring-[#b9f0d7]/90 backdrop-blur-sm",
    label: "text-[#1a7560]",
    detail: "text-[#3d6358]",
    overlay:
      "bg-[linear-gradient(135deg,rgba(243,255,249,0.08)_0%,rgba(233,250,242,0.08)_52%,rgba(220,245,234,0.08)_100%)]",
    symbol: "$",
    fallback: "bg-[linear-gradient(135deg,#f3fff9_0%,#e9faf2_100%)]",
  },
  amber: {
    border: "border-[#ecd9a0]/80",
    stripe: "bg-[#f4c95d]",
    icon: "bg-[#f4c95d]/18 text-[#8f6410] ring-[#f7dfaa]/90 backdrop-blur-sm",
    label: "text-[#8a6010]",
    detail: "text-[#6b5530]",
    overlay:
      "bg-[linear-gradient(135deg,rgba(255,253,246,0.08)_0%,rgba(255,247,228,0.08)_52%,rgba(255,240,210,0.08)_100%)]",
    symbol: "Pay",
    fallback: "bg-[linear-gradient(135deg,#fffdf6_0%,#fff7e4_100%)]",
  },
  rose: {
    border: "border-[#ebc0cc]/80",
    stripe: "bg-[#e76f8a]",
    icon: "bg-[#e76f8a]/14 text-[#b84d66] ring-[#f3c0cd]/90 backdrop-blur-sm",
    label: "text-[#9a4056]",
    detail: "text-[#6f4a55]",
    overlay:
      "bg-[linear-gradient(135deg,rgba(255,249,251,0.08)_0%,rgba(255,240,244,0.08)_52%,rgba(255,228,234,0.08)_100%)]",
    symbol: "!",
    fallback: "bg-[linear-gradient(135deg,#fff9fb_0%,#fff0f4_100%)]",
  },
};

export function AdminMetricCard({
  label,
  value,
  detail,
  accent = "indigo",
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: AdminMetricAccent;
}) {
  const style = accentStyles[accent];
  const [imageFailed, setImageFailed] = useState(false);
  const backgroundUrl = KPI_CARD_BACKGROUNDS[accent];

  return (
    <article
      className={`admin-metric-card group relative overflow-hidden rounded-xl border shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_12px_32px_rgba(14,48,72,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(14,48,72,0.09)] ${style.border} ${imageFailed ? style.fallback : ""}`}
    >
      {!imageFailed ? (
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-[0.78] saturate-[1.1] transition duration-300 group-hover:scale-[1.14] group-hover:opacity-[0.86]"
          style={{ backgroundImage: `url("${backgroundUrl}")` }}
          aria-hidden
        >
          <img
            src={backgroundUrl}
            alt=""
            className="hidden"
            onError={() => setImageFailed(true)}
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}

      <div className={`absolute inset-0 ${style.overlay}`} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_40%,rgba(6,25,37,0.03)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-[linear-gradient(270deg,rgba(255,255,255,0.10)_0%,transparent_100%)]"
        aria-hidden
      />

      <span className={`absolute inset-y-0 left-0 z-10 w-1 ${style.stripe}`} aria-hidden />

      <div className="relative z-10 flex items-start gap-3.5 px-4 py-4 pl-[1.15rem]">
        <div
          className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[0.62rem] font-black uppercase tracking-wide ring-1 ${style.icon}`}
          aria-hidden
        >
          {style.symbol}
        </div>

        <div className="min-w-0 flex-1 space-y-1 rounded-lg bg-white/45 px-2 py-1.5 backdrop-blur-[6px]">
          <p className={`text-[0.6rem] font-bold uppercase tracking-[0.16em] ${style.label}`}>{label}</p>
          <p className="truncate text-[1.65rem] font-black leading-[1.05] tracking-tight text-[#03121c] [text-shadow:0_1px_0_rgba(255,255,255,0.65)] sm:text-[1.75rem]">
            {value}
          </p>
          {detail ? (
            <p className={`truncate pt-0.5 text-[0.8rem] font-semibold leading-snug ${style.detail}`}>{detail}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
