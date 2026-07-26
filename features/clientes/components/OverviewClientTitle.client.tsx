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
      className="mt-1.5 text-[1.4rem] font-medium tracking-[-0.015em] text-[#1a1612] sm:text-[1.55rem]"
    />
  );
}
