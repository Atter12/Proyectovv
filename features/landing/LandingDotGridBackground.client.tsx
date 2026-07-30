"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

/** Dot grid suave para landing clara — no compite con el copy. */
export function LandingDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={2.25}
        gap={26}
        baseColor="#e8e2da"
        activeColor="#ff781f"
        proximity={150}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 44% 46%, rgb(255 255 255 / 0.82) 0%, rgb(251 250 248 / 0.45) 52%, transparent 78%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 48% 38% at 10% 6%, rgb(255 120 31 / 0.03), transparent 70%), radial-gradient(ellipse 42% 36% at 92% 88%, rgb(255 161 44 / 0.02), transparent 68%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255_/_0.7)_0%,transparent_16%,transparent_84%,rgb(248_246_243_/_0.55)_100%)]" />
    </div>
  );
}
