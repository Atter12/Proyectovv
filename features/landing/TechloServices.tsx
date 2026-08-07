import type { ReactNode } from "react";

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
      <path d="M20 7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
      <path d="M17 13.5h.01" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11v3l14 5V6L3 11Z" />
      <path d="M17 8.5a4 4 0 0 1 0 8" />
      <path d="M7.5 14.8V19a1.5 1.5 0 0 0 3 0v-3" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
      <path d="M19 15l.9 2.4L22 18.3l-2.1.9L19 21.5l-.9-2.3-2.1-.9 2.1-.9L19 15Z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12Z" />
      <path d="M9 11.5h.01" />
      <path d="M12.5 11.5h.01" />
      <path d="M16 11.5h.01" />
    </svg>
  );
}

function ArrowsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h13" />
      <path d="M14 3l4 4-4 4" />
      <path d="M20 17H7" />
      <path d="M10 13l-4 4 4 4" />
    </svg>
  );
}

const SERVICES: ReadonlyArray<{
  title: string;
  hint: string;
  tag: string;
  icon: ReactNode;
}> = [
  {
    title: "Cartera Holistic",
    hint: "Recargas y saldo listo para asignar",
    tag: "Pagos",
    icon: <WalletIcon />,
  },
  {
    title: "Cuentas TikTok",
    hint: "Advertisers aprobados por cliente",
    tag: "Ads",
    icon: <MegaphoneIcon />,
  },
  {
    title: "Pagos & ledger",
    hint: "Stripe, BM y historial Hecom",
    tag: "Finanzas",
    icon: <LedgerIcon />,
  },
  {
    title: "Analizador creativo",
    hint: "Subí piezas y encolá análisis",
    tag: "Creativos",
    icon: <SparklesIcon />,
  },
  {
    title: "Operación Latam",
    hint: "Soporte en español, flujo claro",
    tag: "Soporte",
    icon: <ChatIcon />,
  },
  {
    title: "Asignación BM",
    hint: "Cash del Business Center → ads",
    tag: "Gerentes",
    icon: <ArrowsIcon />,
  },
];

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
              className="tl-service-card p-6 sm:p-7"
              data-scroll-reveal="zoom-in"
              data-scroll-reveal-delay={String((index % 3) * 100)}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="tl-service-icon">{item.icon}</span>
                <span className="tl-service-tag">{item.tag}</span>
              </div>
              <p className="tl-h3 mt-5 text-[1.1rem]">{item.title}</p>
              <p className="mt-1.5 text-[0.92rem] leading-7">{item.hint}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
