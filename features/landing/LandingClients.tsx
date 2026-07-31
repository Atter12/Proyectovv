import { LandingReveal } from "./LandingReveal.client";

/** Agencias / marcas ficticias — social proof de escala. */
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
    <section className="border-y border-[var(--auth-divider)] bg-white/80 px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-center text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
            Más de 180 equipos ya operan con Holistic
          </p>
        </LandingReveal>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-4">
          {CLIENTS.map((client, index) => (
            <LandingReveal key={client.name} delayMs={40 + index * 25}>
              <div className="flex h-[4.5rem] flex-col items-center justify-center rounded-xl border border-[var(--auth-divider)] bg-[#f8fafc] px-3 text-center">
                <p className="text-[13px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                  {client.name}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--auth-text-soft)]">
                  {client.city}
                </p>
              </div>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
