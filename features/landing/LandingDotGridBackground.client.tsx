"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

/** Dot grid con el naranja del cursor (#ff781f) — página tintada peach. */
export function LandingDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={2.5}
        gap={24}
        baseColor="#f0c4a4"
        activeColor="#ff781f"
        proximity={190}
      />

      {/* Wash suave: deja ver el glow naranja del cursor */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 44% 46%, rgb(255 244 235 / 0.45) 0%, rgb(255 236 220 / 0.2) 55%, transparent 78%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 42% at 12% 8%, rgb(255 120 31 / 0.14), transparent 68%), radial-gradient(ellipse 48% 40% at 90% 88%, rgb(255 161 44 / 0.12), transparent 66%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_250_246_/_0.35)_0%,transparent_20%,transparent_80%,rgb(255_238_222_/_0.4)_100%)]" />
    </div>
  );
}
