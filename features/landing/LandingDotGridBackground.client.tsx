"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

/** Glow naranja ámbar fijo — sin coral/rosa. */
export function LandingDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={2.5}
        gap={24}
        baseColor="#f0c078"
        activeColor="#ff781f"
        proximity={160}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 40% 35%, rgb(255 176 64 / 0.22), transparent 70%), radial-gradient(ellipse 55% 50% at 85% 75%, rgb(255 161 44 / 0.16), transparent 68%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_248_239_/_0.28)_0%,transparent_20%,transparent_80%,rgb(255_224_168_/_0.28)_100%)]" />
    </div>
  );
}
