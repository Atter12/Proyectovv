"use client";

import { useEffect } from "react";

/**
 * Techlo scroll-reveal (IntersectionObserver) — same pattern as GlobalScripts.
 * Lenis skipped (npm cert issue); native smooth scroll still works.
 */
export function TechloMotionRoot({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.querySelector(".techlo-landing");
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      root.classList.add("animations-disabled");
      return;
    }

    root.classList.add("scroll-reveal-enabled");

    const nodes = root.querySelectorAll<HTMLElement>("[data-scroll-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const delay = el.dataset.scrollRevealDelay;
          if (delay) {
            el.style.setProperty("--scroll-reveal-delay", `${delay}ms`);
          }
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
