"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

export function AuthDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={3}
        gap={20}
        baseColor="#132033"
        activeColor="#3d9aff"
        proximity={180}
      />

      {/* Soften dots under content so text stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 70% at 42% 48%, rgb(7 17 31 / 0.88) 0%, rgb(7 17 31 / 0.55) 42%, transparent 72%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(7_17_31_/_0.35)_0%,transparent_18%,transparent_82%,rgb(7_17_31_/_0.4)_100%)]" />
    </div>
  );
}
