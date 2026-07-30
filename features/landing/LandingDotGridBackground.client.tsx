"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

/** Fondo naranja fuerte; dots del mismo tono Holistic. */
export function LandingDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={2.6}
        gap={22}
        baseColor="#e88940"
        activeColor="#ff781f"
        proximity={170}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 68% at 38% 32%, rgb(255 120 31 / 0.35), transparent 68%), radial-gradient(ellipse 58% 52% at 88% 78%, rgb(255 161 44 / 0.28), transparent 65%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_220_140_/_0.2)_0%,transparent_22%,transparent_78%,rgb(255_176_64_/_0.35)_100%)]" />
    </div>
  );
}
