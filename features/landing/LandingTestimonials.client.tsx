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
    <section id="opiniones" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.35rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.5rem]">
            Opiniones
          </p>
          <h2 className="mt-2 max-w-[28ch] text-[2rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.35rem]">
            Lo que dicen agencias y equipos que ya escalan con Holistic.
          </h2>
        </LandingReveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {QUOTES.map((item, index) => (
            <LandingReveal key={item.name} delayMs={50 + index * 40}>
              <article className="auth-panel flex h-full flex-col rounded-[1.25rem] p-6 sm:p-7">
                <p className="flex-1 text-[15px] font-medium leading-7 text-[var(--auth-text)]">
                  “{item.quote}”
                </p>
                <div className="mt-6 flex items-center gap-3 border-t border-[var(--auth-divider)] pt-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--auth-accent-soft)] text-[12px] font-bold text-[var(--auth-accent)]">
                    {initials(item.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                      {item.name}
                    </p>
                    <p className="truncate text-[12px] font-medium text-[var(--auth-text-soft)]">
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
