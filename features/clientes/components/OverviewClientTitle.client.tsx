"use client";

import { BlurText } from "@/components/react-bits/BlurText";

export function OverviewClientTitle({ name }: { name: string }) {
  return (
    <BlurText
      as="h1"
      text={name}
      animateBy="words"
      direction="top"
      delay={40}
      stepDuration={0.18}
      className="font-display mt-2 text-[2rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--auth-text)] sm:text-[2.45rem] lg:text-[2.75rem]"
    />
  );
}
