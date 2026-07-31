"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { LandingReveal } from "./LandingReveal.client";

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

export function LandingTestimonials() {
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
    <section id="opiniones" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.35rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.5rem]">
            Opiniones
          </p>
          <h2 className="mt-2 max-w-[24ch] text-[2rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.35rem]">
            Equipos que ya operan con más claridad.
          </h2>
        </LandingReveal>

        <LandingReveal delayMs={100}>
          <div className="auth-panel mt-10 rounded-[1.25rem] p-7 sm:p-9">
            <div key={quote.name} className={cn(!reduceMotion && "testimonial-enter")}>
              <p className="max-w-3xl text-[1.25rem] font-medium leading-8 tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.4rem] sm:leading-9">
                “{quote.quote}”
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                    {quote.name}
                  </p>
                  <p className="mt-0.5 text-[14px] font-medium text-[var(--auth-text-soft)]">
                    {quote.role}
                  </p>
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
                          ? "w-5 bg-[var(--auth-accent)]"
                          : "w-2 bg-[var(--auth-dot-mute)] hover:bg-[var(--auth-dot-mute-hover)]",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
