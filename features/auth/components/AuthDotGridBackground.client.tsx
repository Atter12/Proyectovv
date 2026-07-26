"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

export function AuthDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={3}
        gap={22}
        baseColor="#3d2e24"
        activeColor="#e88945"
        proximity={180}
      />

      {/* Soft warm wash — readable dots, glow without intensity */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 42% 48%, rgb(22 17 13 / 0.58) 0%, rgb(22 17 13 / 0.28) 48%, transparent 74%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 12% 8%, rgb(255 120 31 / 0.06), transparent 70%), radial-gradient(ellipse 45% 40% at 90% 90%, rgb(255 77 45 / 0.04), transparent 68%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(20_16_12_/_0.22)_0%,transparent_22%,transparent_78%,rgb(20_16_12_/_0.28)_100%)]" />
    </div>
  );
}
