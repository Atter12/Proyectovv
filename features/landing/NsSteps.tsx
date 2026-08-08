"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { routes } from "@/config/routes";
import { NsReveal } from "./NsReveal.client";

const steps = [
  {
    n: "01",
    title: "Alta y cliente operativo.",
    description:
      "Entrá al panel, vinculá o elegí el cliente Hecom y ya tenés scope limpio.",
  },
  {
    n: "02",
    title: "Recargá o fondeá ads.",
    description:
      "Cliente con Stripe; gerente con fondeo BM. La plata llega a la cuenta que importa.",
  },
  {
    n: "03",
    title: "Medí gasto todos los días.",
    description:
      "Hoy, 7d y 30d con la sync TikTok — sin pedirle un Excel a nadie.",
  },
] as const;

export function NsSteps() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const bars = root.querySelectorAll<HTMLElement>(".ns-progress");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      bars.forEach((el) => el.classList.add("is-on"));
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        bars.forEach((el, i) => {
          window.setTimeout(() => el.classList.add("is-on"), i * 450);
        });
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  return (
    <section id="proceso" className="ns-section" aria-label="Proceso">
      <div className="ns-container space-y-12">
        <div
          ref={ref}
          className="flex flex-col items-start gap-8 md:flex-row xl:items-start"
        >
          {steps.map((step, index) => (
            <NsReveal
              key={step.n}
              delayMs={80 + index * 90}
              className="w-full max-w-[24rem] space-y-3 md:flex-1"
            >
              <div className="ns-progress" data-step={index + 1}>
                <i />
              </div>
              <p className="text-sm font-medium text-[var(--ns-primary)]">
                {step.n}
              </p>
              <div className="space-y-2">
                <h3 className="ns-h3">{step.title}</h3>
                <p className="text-[0.95rem] text-[var(--ns-muted)]">
                  {step.description}
                </p>
              </div>
            </NsReveal>
          ))}
        </div>
        <NsReveal delayMs={360}>
          <Link
            href={routes.register}
            className="ns-btn ns-btn-md ns-btn-secondary"
          >
            Empezar el onboarding
          </Link>
        </NsReveal>
      </div>
    </section>
  );
}
