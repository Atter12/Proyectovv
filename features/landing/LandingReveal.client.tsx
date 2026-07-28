"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Entrada suave sin dejar la página en blanco.
 * SSR / sin JS → siempre visible. Con JS → anima una vez.
 */
export function LandingReveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const id = window.setTimeout(() => setAnimate(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  return (
    <div
      className={cn(className, animate && "landing-reveal-in")}
      style={
        animate && delayMs > 0
          ? ({ animationDelay: `${Math.min(delayMs, 400)}ms` } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
