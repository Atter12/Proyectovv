"use client";

import { useEffect, useState } from "react";

const QUOTES = [
  {
    quote:
      "Pasamos de hojas de cálculo a una visión clara de pagos, saldos y campañas.",
    name: "María González",
    role: "Growth Lead · Norte Ads",
  },
  {
    quote:
      "La asignación de saldo y el seguimiento de cuentas se sienten rápidos y ordenados.",
    name: "Ricardo Salas",
    role: "Media Buyer · Pulse Media",
  },
  {
    quote:
      "Escalamos clientes sin perder control de saldos ni de quién gastó qué.",
    name: "Andrés Melo",
    role: "CEO · Vértice Digital",
  },
] as const;

export function TechloQuotes() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % QUOTES.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  const item = QUOTES[index]!;

  return (
    <section id="opiniones" className="tl-quote tl-section">
      <div
        className="tl-container mx-auto max-w-4xl text-center"
        data-scroll-reveal="blur-up"
      >
        <p className="text-[var(--tl-accent)]">★★★★★</p>
        <blockquote className="tl-display tl-display-light mt-6 text-[clamp(1.45rem,1rem+1.8vw,2.35rem)] leading-snug">
          “{item.quote}”
        </blockquote>
        <p className="mt-8 text-[1.05rem] font-semibold text-white">
          {item.name}
        </p>
        <p className="mt-1 text-[0.95rem] text-[var(--tl-light)]">{item.role}</p>

        <div className="mt-8 flex justify-center gap-2">
          {QUOTES.map((q, i) => (
            <button
              key={q.name}
              type="button"
              aria-label={`Cita ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i === index ? "bg-[var(--tl-primary)]" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
