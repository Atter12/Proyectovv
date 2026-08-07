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
  return (
    <section id="opiniones" className="tl-section bg-[var(--tl-theme-light)]">
      <div className="tl-container space-y-12">
        <div className="mx-auto max-w-3xl text-center" data-scroll-reveal="blur-up">
          <p className="tl-eyebrow">Opiniones</p>
          <h2 className="tl-display tl-display-md mt-3">
            Equipos que ya operan con Holistic
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6">
          {QUOTES.map((item, index) => (
            <figure
              key={item.name}
              className="tl-quote-card"
              data-scroll-reveal="zoom-in"
              data-scroll-reveal-delay={String(index * 100)}
            >
              <p aria-hidden className="text-[var(--tl-accent)]">
                ★★★★★
              </p>
              <blockquote className="text-[1.02rem] leading-[1.7] text-[var(--tl-dark)]">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tl-primary-soft)] text-[0.8rem] font-bold text-[var(--tl-primary)]"
                >
                  {item.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span>
                  <p className="font-semibold text-[var(--tl-dark)]">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[0.9rem] text-[var(--tl-muted)]">
                    {item.role}
                  </p>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
