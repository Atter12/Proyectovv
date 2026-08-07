const STATS = [
  { value: "180+", label: "Equipos activos" },
  { value: "42", label: "Agencias partner" },
  { value: "9", label: "Países Latam" },
  { value: "$4.2M", label: "Gestionados / mes" },
] as const;

export function TechloStats() {
  return (
    <section className="border-y border-[var(--tl-border)] bg-white">
      <div className="tl-container py-14 sm:py-16">
        <div
          className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4"
          data-scroll-reveal="fade-up"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[2rem] font-bold tracking-[-0.04em] tabular-nums text-[var(--tl-dark)] sm:text-[2.5rem]">
                {stat.value}
              </p>
              <p className="mt-1 text-[0.82rem] font-semibold uppercase tracking-[0.1em] text-[var(--tl-muted)]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
