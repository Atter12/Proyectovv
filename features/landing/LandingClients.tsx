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
    <section className="border-y border-[var(--auth-divider)] bg-white/80 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)] sm:text-[13px] sm:tracking-[0.14em]">
            Más de 180 equipos ya operan con Holistic
          </p>
        </LandingReveal>

        {/* Mobile: scroll horizontal pro / Desktop: grilla */}
        <div className="mt-6 sm:mt-8">
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6 lg:gap-4">
            {CLIENTS.map((client, index) => (
              <LandingReveal
                key={client.name}
                delayMs={index < 6 ? 40 + index * 20 : 0}
                className="w-[42vw] shrink-0 sm:w-auto"
              >
                <div className="flex h-16 flex-col items-center justify-center rounded-xl border border-[var(--auth-divider)] bg-[#f8fafc] px-2.5 text-center sm:h-[4.5rem] sm:px-3">
                  <p className="text-[12px] font-bold tracking-[-0.02em] text-[var(--auth-text)] sm:text-[13px]">
                    {client.name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-[var(--auth-text-soft)] sm:text-[11px]">
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
