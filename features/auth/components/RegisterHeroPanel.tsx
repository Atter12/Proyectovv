"use client";

import { useEffect, useState } from "react";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
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
    <div className="relative z-10 hidden min-h-0 flex-col justify-center py-10 lg:flex">
      <div className="auth-copy-well">
        <AuthBrandMark />

        <div className="relative z-10 mt-9 max-w-[38rem]">
          <p className="text-[14px] font-semibold tracking-[0.06em] text-[var(--auth-accent)]">
            Registro gratuito
          </p>

          {reduceMotion ? (
            <h1 className="font-display mt-4 text-[2.85rem] font-medium leading-[1.08] tracking-[-0.025em] text-[var(--auth-text)] xl:text-[3.25rem]">
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
              className="font-display mt-4 text-[2.85rem] font-medium leading-[1.08] tracking-[-0.025em] text-[var(--auth-text)] xl:text-[3.25rem]"
            />
          )}

          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--auth-text-muted)]">
            Únete a anunciantes y agencias que centralizan campañas, pagos y
            creatividades en un solo panel.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3.5">
                <span
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--auth-accent)] shadow-[0_0_12px_rgb(23_139_255_/_0.65)]"
                  aria-hidden
                />
                <div>
                  <p className="text-[15px] font-semibold text-[var(--auth-text)]">
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

      <div className="auth-panel relative z-10 mt-9 max-w-[38rem] rounded-[14px] p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
          Cómo empezar
        </p>
        <ol className="mt-4 space-y-4">
          {STEPS.map((item) => (
            <li key={item.step} className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent)] text-[12px] font-bold text-white shadow-[0_8px_18px_rgb(23_139_255_/_0.28)]">
                {item.step}
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[var(--auth-text)]">
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
