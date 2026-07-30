"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

/** Dot grid suave para landing clara — no compite con el copy. */
export function LandingDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={2.5}
        gap={24}
        baseColor="#d4cbc0"
        activeColor="#ff781f"
        proximity={160}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 68% at 44% 46%, rgb(246 243 239 / 0.72) 0%, rgb(246 243 239 / 0.35) 50%, transparent 76%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 48% 38% at 10% 6%, rgb(255 120 31 / 0.05), transparent 70%), radial-gradient(ellipse 42% 36% at 92% 88%, rgb(255 161 44 / 0.04), transparent 68%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(251_249_246_/_0.55)_0%,transparent_18%,transparent_82%,rgb(243_239_233_/_0.65)_100%)]" />
    </div>
  );
}
