"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const QUOTES = [
  {
    name: "María González",
    role: "Growth Lead · Lima",
    quote:
      "Pasamos de hojas de cálculo a una visión clara de pagos, saldos y campañas.",
  },
  {
    name: "Ricardo Salas",
    role: "Media Buyer · Bogotá",
    quote:
      "La asignación de saldo y el seguimiento de cuentas se sienten rápidos y ordenados.",
  },
  {
    name: "Valeria Torres",
    role: "Founder · Santiago",
    quote:
      "Ordenamos la operación publicitaria sin perder velocidad desde el primer día.",
  },
] as const;

/** Social proof — mismo tono que LoginHeroPanel, adaptado a la landing cream. */
export function LandingProof() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const quote = QUOTES[activeIndex];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % QUOTES.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] px-5 py-6 sm:px-8 sm:py-7">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#e85a1c,#ffa12c)]"
      />
      <div key={quote.name} className={cn(!reduceMotion && "testimonial-enter")}>
        <p className="max-w-2xl text-[16px] leading-7 tracking-[-0.01em] text-[#1a1612] sm:text-[17px]">
          “{quote.quote}”
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
              {quote.name}
            </p>
            <p className="mt-0.5 text-[13px] text-[#7a736a]">{quote.role}</p>
          </div>
          <div className="flex gap-1.5">
            {QUOTES.map((item, index) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Ver reseña ${index + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  index === activeIndex
                    ? "w-5 bg-[#e85a1c]"
                    : "w-2 bg-[rgb(20_18_16_/_0.15)] hover:bg-[rgb(20_18_16_/_0.28)]",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
