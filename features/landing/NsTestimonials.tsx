import Image from "next/image";
import { NsReveal } from "./NsReveal.client";

const quotes = [
  {
    name: "Martín A.",
    company: "Agencia performance · Lima",
    text: "Pasamos de pelear planillas a ver gasto del día del cliente en segundos. El gerente y el cliente miran lo mismo.",
    avatar: "/nexsas/ns-avatar-1.png",
  },
  {
    name: "Valentina R.",
    company: "E-commerce · Bogotá",
    text: "Recargar y asignar a TikTok sin perder el hilo de la deuda neta Hecom nos bajó el ruido operativo de la semana.",
    avatar: "/nexsas/ns-avatar-2.png",
  },
  {
    name: "Diego P.",
    company: "Media buying · CDMX",
    text: "La vista de 7d y 30d junto al listado de gastos es lo que pedíamos: control diario sin exportar a Excel.",
    avatar: "/nexsas/ns-avatar-3.png",
  },
] as const;

export function NsTestimonials() {
  const loop = [...quotes, ...quotes];

  return (
    <section id="opiniones" className="ns-section bg-[var(--ns-bg-3)]">
      <div className="ns-container mb-14 text-center">
        <NsReveal delayMs={40}>
          <h2 className="ns-h2">Lo que dicen los equipos</h2>
        </NsReveal>
      </div>

      <div className="ns-marquee">
        <div
          className="pointer-events-none absolute top-0 left-0 z-10 h-full w-[12%] bg-gradient-to-r from-[var(--ns-bg-3)] to-transparent md:w-[18%]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-0 right-0 z-10 h-full w-[12%] bg-gradient-to-l from-[var(--ns-bg-3)] to-transparent md:w-[18%]"
          aria-hidden
        />
        <div className="ns-marquee-track gap-8 pl-8">
          {loop.map((q, i) => (
            <article
              key={`${q.name}-${i}`}
              className="ns-quote-card space-y-6"
            >
              <p className="text-base leading-relaxed text-[var(--ns-secondary)] md:text-lg">
                “{q.text}”
              </p>
              <div className="flex items-center gap-3">
                <Image
                  src={q.avatar}
                  alt=""
                  width={44}
                  height={44}
                  className="size-11 rounded-full bg-[#98AAC3]"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--ns-secondary)]">
                    {q.name}
                  </p>
                  <span className="text-xs text-[var(--ns-muted)]">
                    {q.company}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
