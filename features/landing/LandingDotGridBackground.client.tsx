"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

/** Dots sobre el gradiente del botón (coral → naranja → ámbar). */
export function LandingDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={2.5}
        gap={22}
        baseColor="#ffc48a"
        activeColor="#ffffff"
        proximity={160}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 15% 20%, rgb(255 77 45 / 0.25), transparent 65%), radial-gradient(ellipse 55% 50% at 90% 80%, rgb(255 161 44 / 0.22), transparent 62%)",
        }}
      />
    </div>
  );
}
