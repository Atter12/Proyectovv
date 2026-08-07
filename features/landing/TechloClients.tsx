const CLIENTS = [
  { name: "Norte Ads", city: "Lima" },
  { name: "Pulse Media", city: "Bogotá" },
  { name: "Andes Growth", city: "Quito" },
  { name: "Orbit Performance", city: "Santiago" },
  { name: "Latam Scale", city: "CDMX" },
  { name: "Vértice Digital", city: "Buenos Aires" },
] as const;

export function TechloClients() {
  return (
    <section className="border-y border-[var(--tl-border)] bg-[var(--tl-theme-light)]">
      <div className="tl-container py-10 sm:py-12">
        <p
          className="text-center text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--tl-muted)]"
          data-scroll-reveal="fade-up"
        >
          Agencias que operan su inversión con Holistic
        </p>
        <div
          className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4"
          data-scroll-reveal="fade-up"
          data-scroll-reveal-delay="80"
        >
          {CLIENTS.map((client) => (
            <div
              key={client.name}
              className="flex h-[4.25rem] flex-col items-center justify-center rounded-xl border border-[var(--tl-border)] bg-white px-3 text-center"
            >
              <p className="text-[0.82rem] font-bold tracking-[-0.02em] text-[var(--tl-dark)]">
                {client.name}
              </p>
              <p className="mt-0.5 text-[0.7rem] font-medium text-[var(--tl-muted)]">
                {client.city}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
