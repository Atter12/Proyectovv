"use client";

import { useState } from "react";
import { KPI_CARD_BACKGROUNDS } from "./kpiCardBackgrounds";
import { cn } from "@/lib/cn";

export type AdminMetricAccent = "indigo" | "emerald" | "amber" | "rose";

const accentStyles: Record<
  AdminMetricAccent,
  {
    border: string;
    stripe: string;
    icon: string;
    label: string;
    detail: string;
    symbol: string;
    fallback: string;
    overlay: string;
  }
> = {
  indigo: {
    border: "border-[#b8dce8]/80",
    stripe: "bg-[#0e7490]",
    icon: "bg-[#0e7490]/14 text-[#0e7490] ring-[#bfe4ee]/90 backdrop-blur-sm",
    label: "text-[#1a6578]",
    detail: "text-[#3d5f6f]",
    symbol: "Org",
    fallback: "bg-[linear-gradient(135deg,#f7fcfe_0%,#eef7fb_100%)]",
    overlay: "from-white/58 via-white/42 to-white/52",
  },
  emerald: {
    border: "border-[#b5e5d4]/80",
    stripe: "bg-[#59c493]",
    icon: "bg-[#59c493]/14 text-[#1a8f6e] ring-[#b9f0d7]/90 backdrop-blur-sm",
    label: "text-[#1a7560]",
    detail: "text-[#3d6358]",
    symbol: "$",
    fallback: "bg-[linear-gradient(135deg,#f3fff9_0%,#e9faf2_100%)]",
    overlay: "from-white/60 via-white/44 to-white/54",
  },
  amber: {
    border: "border-[#ecd9a0]/80",
    stripe: "bg-[#f4c95d]",
    icon: "bg-[#f4c95d]/18 text-[#8f6410] ring-[#f7dfaa]/90 backdrop-blur-sm",
    label: "text-[#8a6010]",
    detail: "text-[#6b5530]",
    symbol: "Pay",
    fallback: "bg-[linear-gradient(135deg,#fffdf6_0%,#fff7e4_100%)]",
    overlay: "from-white/64 via-white/50 to-white/60",
  },
  rose: {
    border: "border-[#ebc0cc]/80",
    stripe: "bg-[#e76f8a]",
    icon: "bg-[#e76f8a]/14 text-[#b84d66] ring-[#f3c0cd]/90 backdrop-blur-sm",
    label: "text-[#9a4056]",
    detail: "text-[#6f4a55]",
    symbol: "!",
    fallback: "bg-[linear-gradient(135deg,#fff9fb_0%,#fff0f4_100%)]",
    overlay: "from-white/62 via-white/48 to-white/58",
  },
};

export function AdminMetricCard({
  label,
  value,
  detail,
  accent = "indigo",
  stretch = false,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: AdminMetricAccent;
  stretch?: boolean;
}) {
  const style = accentStyles[accent];
  const backgroundUrls = KPI_CARD_BACKGROUNDS[accent];
  const [urlIndex, setUrlIndex] = useState(0);
  const imageFailed = urlIndex >= backgroundUrls.length;
  const backgroundUrl = backgroundUrls[urlIndex];

  function handleBackgroundError() {
    setUrlIndex((current) => current + 1);
  }

  return (
    <article
      className={cn(
        "admin-metric-card group relative overflow-hidden rounded-xl border shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_12px_32px_rgba(14,48,72,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(14,48,72,0.09)]",
        style.border,
        imageFailed ? style.fallback : "",
        stretch ? "flex h-full min-h-0 flex-col" : "",
      )}
    >
      {!imageFailed ? (
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <img
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center saturate-[1.06] contrast-[1.05] transition duration-300 group-hover:scale-[1.02]"
            onError={handleBackgroundError}
            loading={accent === "rose" ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
          <div className={cn("absolute inset-0 bg-gradient-to-r", style.overlay)} />
        </div>
      ) : null}

      <span className={`absolute inset-y-0 left-0 z-10 w-1 ${style.stripe}`} aria-hidden />

      <div
        className={cn(
          "relative z-10 flex items-start gap-3.5 px-4 py-4 pl-[1.15rem]",
          stretch ? "min-h-0 flex-1" : "",
        )}
      >
        <div
          className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[0.62rem] font-black uppercase tracking-wide ring-1 ${style.icon}`}
          aria-hidden
        >
          {style.symbol}
        </div>

        <div className="min-w-0 flex-1 space-y-1 rounded-lg bg-white/84 px-2.5 py-2 ring-1 ring-white/70 backdrop-blur-[2px]">
          <p className={`text-[0.6rem] font-bold uppercase tracking-[0.14em] ${style.label}`}>{label}</p>
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
