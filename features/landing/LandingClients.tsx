import { LandingReveal } from "./LandingReveal.client";

const CLIENTS = [
  { name: "Norte Ads", city: "Lima" },
  { name: "Pulse Media", city: "Bogotá" },
  { name: "Andes Growth", city: "Quito" },
  { name: "Orbit Performance", city: "Santiago" },
  { name: "Latam Scale", city: "CDMX" },
  { name: "Vértice Digital", city: "Buenos Aires" },
  { name: "Cumbre Ads", city: "Medellín" },
  { name: "Foco Commerce", city: "Lima" },
  { name: "Ruta Performance", city: "Guayaquil" },
  { name: "Aura Media", city: "Montevideo" },
  { name: "Trópico Labs", city: "São Paulo" },
  { name: "Delta Buyers", city: "Caracas" },
] as const;

export function LandingClients() {
  return (
    <section className="border-y border-[var(--landing-hairline)] bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto w-full max-w-[72rem]">
        <LandingReveal>
          <p className="landing-label text-center !text-[var(--landing-muted)]">
            Más de 180 equipos ya operan con Holistic
          </p>
        </LandingReveal>

        <div className="mt-7 sm:mt-8">
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6">
            {CLIENTS.map((client, index) => (
              <LandingReveal
                key={client.name}
                delayMs={index < 6 ? 40 + index * 25 : 0}
                className="w-[42vw] shrink-0 sm:w-auto"
              >
                <div className="landing-card flex h-16 flex-col items-center justify-center px-2.5 text-center sm:h-[4.5rem] sm:px-3">
                  <p className="font-register text-[0.8125rem] font-bold tracking-[-0.02em] text-[var(--landing-ink)]">
                    {client.name}
                  </p>
                  <p className="mt-0.5 text-[0.7rem] text-[var(--landing-muted)]">
                    {client.city}
                  </p>
                </div>
              </LandingReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
