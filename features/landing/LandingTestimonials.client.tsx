import { LandingReveal } from "./LandingReveal.client";

const QUOTES = [
  {
    name: "María González",
    role: "Growth Lead · Lima",
    company: "Norte Ads",
    quote:
      "Pasamos de hojas de cálculo a una visión clara de pagos, saldos y campañas.",
  },
  {
    name: "Ricardo Salas",
    role: "Media Buyer · Bogotá",
    company: "Pulse Media",
    quote:
      "La asignación de saldo y el seguimiento de cuentas se sienten rápidos y ordenados.",
  },
  {
    name: "Valeria Torres",
    role: "Founder · Santiago",
    company: "Orbit Performance",
    quote:
      "Ordenamos la operación publicitaria sin perder velocidad desde el primer día.",
  },
  {
    name: "Diego Paredes",
    role: "Head of Paid · Quito",
    company: "Andes Growth",
    quote:
      "El equipo dejó de pelear por Excel: ahora todos miran la misma cartera y el mismo historial.",
  },
  {
    name: "Camila Ruiz",
    role: "Performance Manager · CDMX",
    company: "Latam Scale",
    quote:
      "Onboarding simple y soporte que entiende cómo compramos media en la región.",
  },
  {
    name: "Andrés Melo",
    role: "CEO · Buenos Aires",
    company: "Vértice Digital",
    quote:
      "Escalamos clientes sin perder control de saldos ni de quién gastó qué.",
  },
] as const;

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function LandingTestimonials() {
  return (
    <section
      id="opiniones"
      className="scroll-mt-20 px-4 py-14 sm:scroll-mt-24 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[72rem]">
        <LandingReveal>
          <p className="landing-label">Opiniones</p>
          <h2 className="font-register mt-3 max-w-[28ch] text-[clamp(1.75rem,2.8vw,2.5rem)] font-bold tracking-[-0.025em] text-[var(--landing-ink)]">
            Lo que dicen equipos que ya escalan con Holistic.
          </h2>
        </LandingReveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUOTES.map((item, index) => (
            <LandingReveal key={item.name} delayMs={40 + index * 35}>
              <article className="landing-card flex h-full flex-col p-5 sm:p-7">
                <p className="flex-1 text-[1.02rem] italic leading-[1.7] text-[var(--landing-body)]">
                  “{item.quote}”
                </p>
                <div className="mt-5 flex items-center gap-3 border-t border-[var(--landing-hairline)] pt-4">
                  <span className="font-register inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(255_120_31_/_0.12)] text-[0.75rem] font-bold text-[var(--landing-accent-text)]">
                    {initials(item.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-register truncate text-[0.9rem] font-bold text-[var(--landing-ink)]">
                      {item.name}
                    </p>
                    <p className="truncate text-[0.78rem] text-[var(--landing-muted)]">
                      {item.role} · {item.company}
                    </p>
                  </div>
                </div>
              </article>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
