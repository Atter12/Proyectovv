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
  return (
    <section id="soluciones" className="tl-section">
      <div className="tl-container space-y-12">
        <div className="mx-auto max-w-3xl text-center" data-scroll-reveal="blur-up">
          <p className="tl-eyebrow">Soluciones</p>
          <h2 className="tl-display tl-display-md mt-3">
            Servicios para operar y crecer con control
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {SERVICES.map((item, index) => (
            <article
              key={item.title}
              className="tl-service-card"
              data-scroll-reveal="zoom-in"
              data-scroll-reveal-delay={String((index % 3) * 100)}
            >
              <div className="tl-service-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt={item.title} loading="lazy" />
                <span className="tl-service-tag">{item.tag}</span>
              </div>
              <div className="p-5">
                <p className="tl-h3 text-[1.1rem]">{item.title}</p>
                <p className="mt-1.5 text-[0.92rem] leading-7">{item.hint}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
