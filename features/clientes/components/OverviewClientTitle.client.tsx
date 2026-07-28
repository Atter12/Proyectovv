"use client";

import { BlurText } from "@/components/react-bits/BlurText";

export function OverviewClientTitle({ name }: { name: string }) {
  return (
    <BlurText
      as="h2"
      text={name}
      animateBy="words"
      direction="top"
      delay={60}
      stepDuration={0.22}
      className="mt-2 text-[1.65rem] font-light leading-[1.15] tracking-[-0.04em] text-[#1a1612] sm:text-[1.9rem]"
    />
  );
}
