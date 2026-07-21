"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

export function AuthDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-100 motion-reduce:hidden">
      <DotGrid
        dotSize={3.5}
        gap={18}
        baseColor="#2a4060"
        activeColor="#4da3ff"
        proximity={200}
        className="opacity-100"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--auth-bg)]/20 via-transparent to-[var(--auth-bg)]/40" />
    </div>
  );
}
