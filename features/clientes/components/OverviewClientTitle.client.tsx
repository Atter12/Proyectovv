"use client";

import { BlurText } from "@/components/react-bits/BlurText";

export function OverviewClientTitle({ name }: { name: string }) {
  return (
    <BlurText
      as="h2"
      text={name}
      animateBy="words"
      direction="top"
      delay={50}
      stepDuration={0.2}
      className="mt-1.5 text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.05rem]"
    />
  );
}
