const STEPS = [
  {
    title: "Recargar cartera",
    description:
      "Ingresá saldo con Stripe, pasarelas locales o flujo manual revisado.",
    image: "/landing/techlo/process/step-01.png",
  },
  {
    title: "Asignar a cuentas ads",
    description:
      "Distribuí presupuesto a TikTok y advertisers aprobados en segundos.",
    image: "/landing/techlo/process/step-02.png",
  },
  {
    title: "Gastar y controlar",
    description:
      "Seguí cobros, gastos y saldo estimado sin salir del panel Holistic.",
    image: "/landing/techlo/process/step-03.png",
  },
] as const;

export function TechloProcess() {
  return (
    <section id="proceso" className="tl-section">
      <div className="tl-container space-y-16">
        <h2
          className="tl-display tl-display-md mx-auto max-w-3xl text-center"
          data-scroll-reveal="blur-up"
        >
          Nuestro proceso para crecer tu operación de ads
        </h2>

        <div className="relative grid grid-cols-1 gap-y-12 md:grid-cols-3 md:gap-x-10 lg:gap-x-16">
          <svg
            className="absolute top-[11.5rem] right-0 left-0 hidden h-1 w-full text-[var(--tl-border)] md:block"
            viewBox="0 0 1116 4"
            fill="none"
            aria-hidden
            preserveAspectRatio="none"
          >
            <path
              d="M0 2H1116"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="8 14"
            />
          </svg>

          {STEPS.map((step, index) => (
            <article
              key={step.title}
              className="relative flex flex-col items-center text-center"
              data-scroll-reveal="zoom-in"
              data-scroll-reveal-delay={String(index * 140)}
            >
              <div className="flex h-40 items-end justify-center sm:h-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.image}
                  alt=""
                  aria-hidden
                  className="h-full w-auto object-contain"
                />
              </div>
              <span className="relative z-10 mt-8 flex size-10 items-center justify-center rounded-full bg-[var(--tl-primary)] text-sm font-semibold text-white">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="tl-h3 mt-7">{step.title}</h3>
              <p className="mx-auto mt-3 max-w-md leading-[1.8]">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
