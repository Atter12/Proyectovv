"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

export function AuthDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden motion-reduce:hidden">
      <DotGrid
        dotSize={3}
        gap={22}
        baseColor="#4a382c"
        activeColor="#ff981f"
        proximity={180}
      />

      {/* Wash más claro — deja ver el naranja del fondo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 42% 48%, rgb(28 22 18 / 0.4) 0%, rgb(28 22 18 / 0.18) 48%, transparent 74%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 52% 42% at 12% 8%, rgb(255 161 44 / 0.14), transparent 70%), radial-gradient(ellipse 45% 40% at 90% 90%, rgb(255 176 64 / 0.1), transparent 68%)",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(28_22_18_/_0.12)_0%,transparent_22%,transparent_78%,rgb(28_22_18_/_0.18)_100%)]" />
    </div>
  );
}
