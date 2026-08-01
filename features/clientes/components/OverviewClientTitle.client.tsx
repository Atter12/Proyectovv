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
      className="mt-1 text-[1.35rem] font-semibold leading-snug tracking-[-0.025em] text-[var(--auth-text)] sm:text-[1.5rem]"
    />
  );
}
