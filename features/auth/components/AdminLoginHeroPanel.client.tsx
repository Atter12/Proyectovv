"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&q=80",
    title: "Monitoreo en tiempo real",
    caption: "KPIs operativos, alertas y seguimiento financiero centralizado.",
  },
  {
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1920&q=80",
    title: "Control financiero",
    caption: "Pagos, wallets, conciliación y auditoría desde un solo panel.",
  },
  {
    image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1920&q=80",
    title: "Gestión de equipos",
    caption: "Organizaciones, usuarios y permisos con trazabilidad completa.",
  },
  {
    image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1920&q=80",
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
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,25,37,0.55)_0%,rgba(6,25,37,0.82)_48%,rgba(4,14,22,0.94)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(720px_360px_at_10%_0%,rgba(116,211,180,0.16),transparent_58%),radial-gradient(620px_320px_at_100%_100%,rgba(117,199,232,0.12),transparent_62%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-8 lg:p-10 xl:p-12">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#9af7c9] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4] shadow-[0_0_12px_rgba(116,211,180,0.55)]" aria-hidden />
            Admin console
          </div>

          <h1 className="max-w-xl text-3xl font-black tracking-[-0.03em] text-white xl:text-4xl">
            Centro de control para operaciones críticas
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-[#c7dce5]">
            Gestiona pagos, organizaciones, soporte y auditoría desde un panel diseñado para equipos operativos.
          </p>
        </div>

        <div className="mt-8 hidden max-w-xl lg:block">
          <div key={slide.title} className="admin-login-slide-copy">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-[#78cce8]">Enfoque operativo</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{slide.title}</h2>
            <p className="mt-2 text-sm leading-7 text-[#b8d0db]">{slide.caption}</p>
          </div>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {CAPABILITIES.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-[#dbe8ee] backdrop-blur-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4]" aria-hidden />
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
                  index === activeIndex ? "w-7 bg-[#74d3b4]" : "w-1.5 bg-white/35 hover:bg-white/60",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
