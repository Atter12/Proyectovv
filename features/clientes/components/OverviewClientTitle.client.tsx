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
      className="font-display mt-2 text-[1.75rem] font-medium text-white sm:text-[2.05rem]"
    />
  );
}
