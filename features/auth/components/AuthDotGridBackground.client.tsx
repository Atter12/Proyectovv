"use client";

import { DotGrid } from "@/components/react-bits/DotGrid";

export function AuthDotGridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-70 motion-reduce:hidden">
      <DotGrid
        dotSize={2.5}
        gap={26}
        baseColor="#152536"
        activeColor="#178bff"
        proximity={140}
        className="opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--auth-bg)]/35 via-transparent to-[var(--auth-bg)]/55" />
    </div>
  );
}
