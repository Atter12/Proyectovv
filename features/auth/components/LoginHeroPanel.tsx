"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { BlurText } from "@/components/react-bits/BlurText";

const FEATURES = [
  {
    title: "Cartera y saldos",
    description: "Asigna presupuesto a cuentas publicitarias en un solo flujo.",
  },
  {
    title: "Pagos integrados",
    description: "Pasarelas locales y seguimiento claro de cada recarga.",
  },
  {
    title: "Operación Latam",
    description: "Soporte en español para equipos en Perú y la región.",
  },
] as const;

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

const HERO_TITLE = "Opera campañas, pagos y saldos en un solo lugar.";

export function LoginHeroPanel() {
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
    <div className="relative z-10 hidden min-h-0 flex-col justify-center py-10 lg:flex">
      <AuthBrandMark />

      <div className="relative z-10 mt-8 max-w-[34rem]">
        <p className="text-[12px] font-medium tracking-[0.08em] text-[var(--auth-accent)]">
          Panel para anunciantes
        </p>

        {reduceMotion ? (
          <h1 className="font-display mt-3 text-[2.35rem] leading-[1.1] tracking-[-0.02em] text-[var(--auth-text)] xl:text-[2.65rem]">
            {HERO_TITLE}
          </h1>
        ) : (
          <BlurText
            as="h1"
            text={HERO_TITLE}
            animateBy="words"
            direction="top"
            delay={80}
            stepDuration={0.26}
            className="font-display mt-3 text-[2.35rem] leading-[1.1] tracking-[-0.02em] text-[var(--auth-text)] xl:text-[2.65rem]"
          />
        )}

        <p className="mt-4 max-w-md text-[14px] leading-6 text-[var(--auth-text-muted)]">
          Una plataforma pensada para agencias y equipos de performance que
          necesitan control real, no otra dashboard genérica.
        </p>

        <ul className="mt-7 space-y-3.5">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-3">
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--auth-accent)] shadow-[0_0_10px_rgb(23_139_255_/_0.55)]"
                aria-hidden
              />
              <div>
                <p className="text-[13px] font-semibold text-[var(--auth-text)]">
                  {feature.title}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--auth-text-muted)]">
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="auth-panel relative z-10 mt-8 max-w-[34rem] rounded-[12px] p-4">
        <div key={quote.name} className={cn(!reduceMotion && "testimonial-enter")}>
          <p className="font-display text-[15px] italic leading-6 text-[var(--auth-text)]">
            &ldquo;{quote.quote}&rdquo;
          </p>
          <div className="mt-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-[var(--auth-text)]">
                {quote.name}
              </p>
              <p className="text-[11px] text-[var(--auth-text-soft)]">{quote.role}</p>
            </div>
            <div className="flex gap-1.5">
              {QUOTES.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Ver reseña ${index + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    index === activeIndex
                      ? "w-4 bg-[var(--auth-accent)]"
                      : "w-1.5 bg-white/25 hover:bg-white/45",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
