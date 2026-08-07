const SERVICES = [
  {
    title: "Cartera Holistic",
    hint: "Recargas y saldo listo para asignar",
    tag: "Pagos",
    image: "/landing/techlo/services/digital-marketing.jpg",
  },
  {
    title: "Cuentas TikTok",
    hint: "Advertisers aprobados por cliente",
    tag: "Ads",
    image: "/landing/techlo/services/web-mobile-app-development.jpg",
  },
  {
    title: "Pagos & ledger",
    hint: "Stripe, BM y historial Hecom",
    tag: "Finanzas",
    image: "/landing/techlo/services/data-tracking-security.jpg",
  },
  {
    title: "Analizador creativo",
    hint: "Subí piezas y encolá análisis",
    tag: "Creativos",
    image: "/landing/techlo/services/ux-branding.jpg",
  },
  {
    title: "Operación Latam",
    hint: "Soporte en español, flujo claro",
    tag: "Soporte",
    image: "/landing/techlo/services/it-management.jpg",
  },
  {
    title: "Asignación BM",
    hint: "Cash del Business Center → ads",
    tag: "Gerentes",
    image: "/landing/techlo/services/cyber-security.jpg",
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
            <article key={`${item.title}-${index}`} className="tl-service-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt={item.title} loading="lazy" />
              <span className="tl-service-tag">{item.tag}</span>
              <div className="label">
                <p>{item.title}</p>
                <p className="mt-1 text-[0.85rem] font-medium text-white/75">
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
