"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
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

export function LoginHeroPanel({
  alwaysVisible = false,
}: {
  /** Landing: mostrar también en mobile. Login: solo desktop. */
  alwaysVisible?: boolean;
}) {
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
    <div
      className={cn(
        "relative z-10 min-h-0 flex-col justify-center px-4 py-6 sm:px-6 lg:px-0 lg:py-10",
        alwaysVisible ? "flex" : "hidden lg:flex",
      )}
    >
      <div className="auth-copy-well">
        <div className="relative z-10 max-w-[38rem] px-1 sm:px-2">
          {/* Estilo Rockads: título de sección en color de marca */}
          <p className="text-[1.35rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.5rem]">
            Panel para anunciantes
          </p>

          {reduceMotion ? (
            <h1 className="mt-3 text-[2.35rem] font-bold leading-[1.2] tracking-[-0.035em] text-[var(--auth-text)] sm:text-[2.65rem] xl:text-[2.85rem]">
              {HERO_TITLE}
            </h1>
          ) : (
            <BlurText
              as="h1"
              text={HERO_TITLE}
              animateBy="words"
              direction="top"
              delay={70}
              stepDuration={0.22}
              className="mt-3 text-[2.35rem] font-bold leading-[1.2] tracking-[-0.035em] text-[var(--auth-text)] sm:text-[2.65rem] xl:text-[2.85rem]"
            />
          )}

          <p className="mt-5 max-w-xl text-[16px] font-medium leading-7 text-[var(--auth-text-muted)]">
            Una plataforma pensada para agencias y equipos de performance que
            necesitan control real, no otra dashboard genérica.
          </p>

          <ul className="mt-9 space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-4">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--auth-accent)]/25 bg-[var(--auth-accent-soft)]"
                  aria-hidden
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--auth-accent)]" />
                </span>
                <div>
                  <p className="text-[15px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                    {feature.title}
                  </p>
                  <p className="mt-1 text-[14px] leading-6 text-[var(--auth-text-muted)]">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="auth-panel relative z-10 mt-8 max-w-[38rem] rounded-[1.25rem] p-6">
        <div key={quote.name} className={cn(!reduceMotion && "testimonial-enter")}>
          <p className="text-[15px] font-medium leading-7 text-[var(--auth-text)]">
            &ldquo;{quote.quote}&rdquo;
          </p>
          <div className="mt-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                {quote.name}
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--auth-text-soft)]">
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
    </div>
  );
}
