"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * Scroll reveal sin FOUC:
 * - SSR / primer paint: siempre visible
 * - Solo elementos bajo el fold se ocultan tras montar, y entran al scrollear
 * - Above-the-fold nunca empieza en opacity:0 (evita el flash de letras)
 */
export function NsxReveal({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div",
  /** Fuerza visible desde el primer paint (hero / above fold). */
  eager = false,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "li" | "article" | "section" | "span";
  eager?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      eager ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      node.classList.add("is-in");
      node.removeAttribute("data-motion");
      return;
    }

    const rect = node.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    if (inView) {
      node.classList.add("is-in");
      node.removeAttribute("data-motion");
      return;
    }

    node.setAttribute("data-motion", "pending");

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add("is-in");
          node.setAttribute("data-motion", "in");
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -4% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [eager]);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`nsx-reveal${eager ? " is-in" : ""} ${className}`.trim()}
      style={{ ["--nsx-delay" as string]: `${delayMs}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
