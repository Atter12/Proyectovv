"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

export function AuthDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={3}
        gap={22}
        baseColor="#4a3428"
        activeColor="#ff8a3d"
        proximity={200}
      />

      {/* Soft warm wash — keeps dots readable without crushing orange glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 42% 48%, rgb(22 17 13 / 0.55) 0%, rgb(22 17 13 / 0.22) 48%, transparent 74%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 12% 8%, rgb(255 120 31 / 0.14), transparent 70%), radial-gradient(ellipse 45% 40% at 90% 90%, rgb(255 77 45 / 0.1), transparent 68%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(20_16_12_/_0.2)_0%,transparent_22%,transparent_78%,rgb(20_16_12_/_0.28)_100%)]" />
    </div>
  );
}
