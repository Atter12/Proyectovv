"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

/**
 * Fondo ya lleva el glow naranja fijo.
 * Los dots refuerzan el mismo tono; el cursor solo intensifica.
 */
export function LandingDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={2.5}
        gap={24}
        baseColor="#f0b48a"
        activeColor="#ff781f"
        proximity={160}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 40% 35%, rgb(255 120 31 / 0.2), transparent 70%), radial-gradient(ellipse 55% 50% at 85% 75%, rgb(255 161 44 / 0.16), transparent 68%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_246_238_/_0.25)_0%,transparent_20%,transparent_80%,rgb(255_217_188_/_0.3)_100%)]" />
    </div>
  );
}
