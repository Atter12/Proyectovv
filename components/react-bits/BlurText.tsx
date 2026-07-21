"use client";

import { motion, type Transition, type Easing } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

type BlurTextProps = {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Array<Record<string, string | number>>;
  easing?: Easing | Easing[];
  onAnimationComplete?: () => void;
  stepDuration?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
};

function buildKeyframes(
  from: Record<string, string | number>,
  steps: Array<Record<string, string | number>>,
): Record<string, Array<string | number>> {
  const keys = new Set<string>([
    ...Object.keys(from),
    ...steps.flatMap((step) => Object.keys(step)),
  ]);

  const keyframes: Record<string, Array<string | number>> = {};
  keys.forEach((key) => {
    keyframes[key] = [from[key] ?? 0, ...steps.map((step) => step[key] ?? 0)];
  });
  return keyframes;
}

/**
 * Adapted from React Bits — Blur Text (TS + Tailwind).
 * @see https://reactbits.dev/text-animations/blur-text
 */
export function BlurText({
  text = "",
  delay = 160,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing = (t: number) => t,
  onAnimationComplete,
  stepDuration = 0.32,
  as: Tag = "p",
}: BlurTextProps) {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = useMemo(
    () =>
      direction === "top"
        ? { filter: "blur(10px)", opacity: 0, y: -36 }
        : { filter: "blur(10px)", opacity: 0, y: 36 },
    [direction],
  );

  const defaultTo = useMemo(
    () => [
      {
        filter: "blur(5px)",
        opacity: 0.5,
        y: direction === "top" ? 4 : -4,
      },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction],
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;
  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, index) =>
    stepCount === 1 ? 0 : index / (stepCount - 1),
  );

  return (
    <Tag ref={ref as never} className={`flex flex-wrap ${className}`}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);
        const spanTransition: Transition = {
          duration: totalDuration,
          times,
          delay: (index * delay) / 1000,
          ease: easing,
        };

        return (
          <motion.span
            key={`${segment}-${index}`}
            initial={fromSnapshot}
            animate={inView ? (animateKeyframes as never) : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={
              index === elements.length - 1 ? onAnimationComplete : undefined
            }
            style={{
              display: "inline-block",
              willChange: "transform, filter, opacity",
            }}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </Tag>
  );
}
