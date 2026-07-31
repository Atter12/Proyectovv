"use client";

import { useEffect, useState } from "react";
import { BlurText } from "@/components/react-bits/BlurText";

const FEATURES = [
  {
    title: "Activa en minutos",
    description: "Organización lista en menos de 5 minutos.",
  },
  {
    title: "Cartera desde el día uno",
    description: "Cuentas publicitarias y saldos listos para operar.",
  },
  {
    title: "Soporte Latam",
    description: "Atención en español para Perú y la región.",
  },
] as const;

const STEPS = [
  { step: "01", title: "Regístrate", description: "Completa tus datos de anunciante" },
  { step: "02", title: "Verifica", description: "Confirma tu correo con un código" },
  { step: "03", title: "Publica", description: "Configura tu primera campaña" },
] as const;

const HERO_TITLE = "Crea tu cuenta y publica con confianza.";

export function RegisterHeroPanel() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);

    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="relative z-10 hidden min-h-0 flex-col justify-center py-6 lg:flex lg:py-10">
      <div className="auth-copy-well">
        <div className="relative z-10 max-w-[38rem] px-1 sm:px-2">
          <p className="text-[1.35rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.5rem]">
            Registro gratuito
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
            Únete a anunciantes y agencias que centralizan campañas, pagos y
            creatividades en un solo panel.
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
        <p className="text-[13px] font-bold tracking-[-0.01em] text-[var(--auth-text-soft)]">
          Cómo empezar
        </p>
        <ol className="mt-4 space-y-4">
          {STEPS.map((item) => (
            <li key={item.step} className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)] text-[12px] font-bold text-[var(--auth-accent)]">
                {item.step}
              </span>
              <div>
                <p className="text-[15px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[14px] leading-6 text-[var(--auth-text-muted)]">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
