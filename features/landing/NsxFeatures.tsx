import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import Link from "next/link";

const features = [
  {
    title: "Cartera y recargas",
    body: "Saldo del cliente, movimientos y top-ups con Stripe o el flujo operativo que ya usas en Hecom Club.",
    icon: "wallet",
  },
  {
    title: "Cuentas y Business Manager",
    body: "Alcance por agencia o cuenta, sin mezclar clientes ni cuentas publicitarias de otros.",
    icon: "scope",
  },
  {
    title: "Gasto TikTok al día",
    body: "Historial y totales por periodo. Menos Excel, más control de cuánto quemó cada cuenta.",
    icon: "trend",
  },
  {
    title: "Roles claros",
    body: "Cliente, manager y admin ven solo lo suyo: mismo producto, permisos y paneles distintos.",
    icon: "people",
  },
  {
    title: "Hecom Club + CRM",
    body: "Cobros y operación alineados a lo que pasa en la calle, no a un export desactualizado.",
    icon: "link",
  },
  {
    title: "Un solo lugar de verdad",
    body: "Deja de pelear con hojas sueltas entre finanzas, media buying y el cliente final.",
    icon: "board",
  },
] as const;

function FeatureIcon({ name }: { name: (typeof features)[number]["icon"] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "wallet":
      return (
        <svg {...common}>
          <path d="M3 8.5h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10Z" />
          <path d="M3 8.5 5.2 4.8A2 2 0 0 1 7 4h10a2 2 0 0 1 1.8.8L21 8.5" />
          <circle cx="17" cy="13.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "scope":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="7" height="7" rx="1.5" />
          <rect x="13" y="5" width="7" height="7" rx="1.5" />
          <rect x="4" y="14" width="7" height="5" rx="1.5" />
          <rect x="13" y="14" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <path d="M4 17 10 11l4 4 6-8" />
          <path d="M14 7h6v6" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5" />
          <path d="M14 19c.3-2 1.6-3.5 3.5-3.5 1.4 0 2.5.8 3 2" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M9 9v11" />
        </svg>
      );
  }
}

export function NsxFeatures() {
  return (
    <section className="nsx-section nsx-features" id="producto">
      <div className="nsx-container">
        <div className="nsx-section-head">
          <span className="nsx-pill">Producto</span>
          <h2 className="nsx-h2">Hecho para operar, no para otro CRM</h2>
          <p>
            {siteConfig.name} concentra el día a día de agencias y equipos que
            viven de TikTok Ads y de la red Hecom Club.
          </p>
        </div>

        <div className="nsx-feature-grid">
          {features.map((f) => (
            <article key={f.title} className="nsx-feature-card">
              <div className="nsx-feature-icon" aria-hidden>
                <FeatureIcon name={f.icon} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>

        <div className="nsx-feature-cta">
          <p>¿Ya tienes acceso? Entra al panel con tu cuenta.</p>
          <Link href={routes.login} className="nsx-btn-dark">
            Entrar <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Ancla de “Proceso” para el menú — flujo operativo simple. */
export function NsxProcess() {
  const steps = [
    {
      n: "01",
      title: "Entras al panel",
      body: "Un solo acceso con la cuenta que te dio Holistic Marketing.",
    },
    {
      n: "02",
      title: "Ves solo lo tuyo",
      body: "Cliente, manager o admin: cada rol ve cartera y cuentas que le corresponden.",
    },
    {
      n: "03",
      title: "Operas el día a día",
      body: "Recargas, gasto TikTok, cobros Hecom y estados de cuenta sin depender de Excel.",
    },
  ];

  return (
    <section className="nsx-section nsx-process" id="proceso">
      <div className="nsx-container">
        <div className="nsx-section-head">
          <span className="nsx-pill">Proceso</span>
          <h2 className="nsx-h2">Cómo se trabaja con el panel</h2>
          <p>
            Sin onboarding eterno: el producto está pensado para la operación
            real de {siteConfig.name} y Hecom Club.
          </p>
        </div>
        <ol className="nsx-process-grid">
          {steps.map((s) => (
            <li key={s.n} className="nsx-process-card">
              <span className="nsx-process-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
