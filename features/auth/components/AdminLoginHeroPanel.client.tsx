"use client";

import { useEffect, useState } from "react";
import { EcomdyLogo } from "@/components/brand/EcomdyLogo";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

const SLIDES = [
  {
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&q=80",
    title: "Monitoreo en tiempo real",
    caption: "KPIs operativos, alertas y seguimiento financiero centralizado.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1920&q=80",
    title: "Control financiero",
    caption: "Pagos, wallets, conciliación y auditoría desde un solo panel.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1920&q=80",
    title: "Gestión de equipos",
    caption: "Organizaciones, usuarios y permisos con trazabilidad completa.",
  },
  {
    image:
      "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1920&q=80",
    title: "Operaciones escalables",
    caption: "Soporte, webhooks e integraciones listas para producción.",
  },
] as const;

const CAPABILITIES = [
  "Pagos manuales y conciliación",
  "Auditoría y trazabilidad",
  "Soporte y tickets operativos",
  "Integraciones y webhooks",
] as const;

type AdminLoginHeroPanelProps = {
  className?: string;
};

export function AdminLoginHeroPanel({ className }: AdminLoginHeroPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = SLIDES[activeIndex];

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % SLIDES.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={cn("admin-login-hero relative overflow-hidden", className)}>
      {SLIDES.map((item, index) => (
        <div
          key={item.image}
          aria-hidden={index !== activeIndex}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            index === activeIndex ? "opacity-100" : "opacity-0",
          )}
        >
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover"
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,31,0.62)_0%,rgba(7,17,31,0.86)_48%,rgba(4,10,18,0.96)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(720px_360px_at_12%_0%,rgba(23,139,255,0.28),transparent_58%),radial-gradient(620px_320px_at_100%_100%,rgba(154,247,201,0.1),transparent_62%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-8 lg:p-10 xl:p-12">
        <div>
          <div className="mb-6 flex items-center gap-3">
            <EcomdyLogo size={44} className="shadow-lg" />
            <div>
              <p className="text-[1.05rem] font-semibold tracking-tight text-white">
                {siteConfig.name}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7cc3ff]">
                Admin console
              </p>
            </div>
          </div>

          <h1 className="font-display max-w-xl text-[2rem] font-medium leading-[1.12] tracking-[-0.02em] text-white xl:text-[2.35rem]">
            Centro de control para operaciones críticas
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-7 text-white/80">
            Gestiona pagos, organizaciones, soporte y auditoría desde un panel
            diseñado para equipos operativos.
          </p>
        </div>

        <div className="mt-8 hidden max-w-xl lg:block">
          <div key={slide.title} className="admin-login-slide-copy">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7cc3ff]">
              Enfoque operativo
            </p>
            <h2 className="font-display mt-2 text-2xl font-medium tracking-tight text-white">
              {slide.title}
            </h2>
            <p className="mt-2 text-[14px] leading-7 text-white/75">{slide.caption}</p>
          </div>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {CAPABILITIES.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[12px] font-medium text-white/90 backdrop-blur-sm"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary,#178bff)]"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center gap-2">
            {SLIDES.map((item, index) => (
              <button
                key={item.image}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Ver escena ${index + 1}: ${item.title}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  index === activeIndex
                    ? "w-7 bg-[var(--brand-primary,#178bff)]"
                    : "w-1.5 bg-white/35 hover:bg-white/60",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
