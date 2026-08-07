const SERVICES = [
  {
    title: "Cartera Holistic",
    hint: "Recargas y saldo listo para asignar",
    tone: "from-[#ff781f]/50 to-[#040d43]",
  },
  {
    title: "Cuentas TikTok",
    hint: "Advertisers aprobados por cliente",
    tone: "from-[#ff9a4a]/40 to-[#040d43]",
  },
  {
    title: "Pagos & ledger",
    hint: "Stripe, BM y historial Hecom",
    tone: "from-[#ff781f]/35 to-[#040d43]",
  },
  {
    title: "Analizador creativo",
    hint: "Subí piezas y encolá análisis",
    tone: "from-[#fbde90]/30 to-[#040d43]",
  },
  {
    title: "Operación Latam",
    hint: "Soporte en español, flujo claro",
    tone: "from-[#e176ca]/25 to-[#040d43]",
  },
  {
    title: "Asignación BM",
    hint: "Cash del Business Center → ads",
    tone: "from-[#ff781f]/45 to-[#040d43]",
  },
] as const;

export function TechloServices() {
  const loop = [...SERVICES, ...SERVICES];

  return (
    <section id="soluciones" className="tl-section overflow-hidden">
      <div className="tl-container space-y-12">
        <h2
          className="tl-display tl-display-md mx-auto max-w-3xl text-center"
          data-scroll-reveal="blur-up"
        >
          Servicios para operar y crecer con control
        </h2>
      </div>

      <div
        className="tl-marquee mt-12"
        data-scroll-reveal="fade-up"
        data-scroll-reveal-delay="120"
      >
        <div className="tl-marquee-track">
          {loop.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className="tl-service-card"
            >
              <div
                aria-hidden
                className={`absolute inset-0 bg-gradient-to-br ${item.tone}`}
              />
              <div className="label">
                <p>{item.title}</p>
                <p className="mt-1 text-[0.85rem] font-medium text-white/70">
                  {item.hint}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
