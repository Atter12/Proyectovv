"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const FEATURES = [
  "Cuentas publicitarias de agencia con límites ampliados",
  "Cartera centralizada y asignación de saldo en un clic",
  "Pasarelas de pago integradas y facturación transparente",
  "Analizador creativo y programa de afiliados incluidos",
] as const;

const METRICS = [
  { value: "+38%", label: "más velocidad operativa" },
  { value: "24/7", label: "respaldo y monitoreo" },
  { value: "1 clic", label: "para asignar saldo" },
] as const;

const TESTIMONIALS = [
  {
    name: "María González",
    role: "Growth Lead",
    location: "Lima, Perú",
    quote:
      "El panel nos dio control total sobre pagos, saldos y campañas. Pasamos de operar con hojas de cálculo a tener una visión clara en tiempo real.",
    initials: "MG",
  },
  {
    name: "Ricardo Salas",
    role: "Media Buyer Senior",
    location: "Bogotá, Colombia",
    quote:
      "La asignación de saldo y el seguimiento de cuentas publicitarias se sienten premium. Todo está donde debe estar y el flujo es muy rápido.",
    initials: "RS",
  },
  {
    name: "Valeria Torres",
    role: "Ecommerce Founder",
    location: "Santiago, Chile",
    quote:
      "Nos ayudó a ordenar la operación publicitaria sin perder velocidad. La experiencia visual transmite confianza desde el primer login.",
    initials: "VT",
  },
] as const;

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-emerald-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-4 w-4 text-[#12d6a3] drop-shadow" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export function LoginHeroPanel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const testimonial = TESTIMONIALS[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % TESTIMONIALS.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative hidden min-h-screen flex-col justify-center overflow-hidden px-10 py-12 lg:flex xl:px-16">
      <div className="auth-luxury-orb pointer-events-none absolute left-12 top-16 h-64 w-64 rounded-full bg-[#4056ff]/20 blur-3xl" />
      <div className="auth-luxury-orb pointer-events-none absolute bottom-12 right-8 h-72 w-72 rounded-full bg-[#7c3aed]/18 blur-3xl [animation-delay:1.4s]" />

      <div className="relative z-10 max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-[#12d6a3] shadow-[0_0_16px_rgb(18_214_163_/_0.7)]" />
          Plataforma publicitaria premium para equipos de alto crecimiento
        </div>

        <h1 className="max-w-2xl text-4xl font-bold leading-[1.06] tracking-[-0.04em] text-white xl:text-5xl">
          Impulsa tus ventas con soluciones publicitarias integradas
        </h1>

        <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
          Controla pagos, saldos, cuentas publicitarias e integraciones desde una experiencia elegante, segura y pensada para escalar operaciones reales.
        </p>

        <div className="mt-7 grid max-w-xl grid-cols-3 gap-3">
          {METRICS.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 backdrop-blur-xl">
              <p className="text-lg font-bold tracking-tight text-white">{metric.value}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{metric.label}</p>
            </div>
          ))}
        </div>

        <ul className="mt-8 space-y-4">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/10 bg-emerald-400/10 shadow-lg shadow-emerald-950/20">
                <CheckIcon />
              </span>
              <span className="text-sm leading-relaxed text-slate-200">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="luxury-card mt-10 rounded-[1.55rem] p-5">
          <div key={testimonial.name} className="testimonial-enter">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4056ff] via-[#6d5df8] to-[#7c3aed] text-sm font-bold text-white shadow-xl shadow-[#4056ff]/30 ring-1 ring-white/20">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs text-slate-400">{testimonial.role} · {testimonial.location}</p>
                </div>
              </div>
              <div className="flex gap-0.5 pt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} />
                ))}
              </div>
            </div>
            <p className="mt-5 text-sm italic leading-7 text-slate-200">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="premium-divider h-1 w-28 rounded-full bg-white/10" />
            <div className="flex justify-center gap-1.5">
              {TESTIMONIALS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Ver reseña ${index + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    index === activeIndex ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/60",
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
