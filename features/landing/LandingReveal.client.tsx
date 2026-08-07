"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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

    const id = window.setTimeout(() => setAnimate(true), Math.min(delayMs, 120));
    return () => window.clearTimeout(id);
  }, [delayMs]);

  const style: CSSProperties | undefined =
    animate && delayMs > 0
      ? { animationDelay: `${Math.min(delayMs, 280)}ms` }
      : undefined;

  return (
    <div className={cn(className, animate && "landing-reveal-in")} style={style}>
      {children}
    </div>
  );
}
