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
      className="mt-1.5 text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[#1a1612] sm:text-[2.05rem]"
    />
  );
}
