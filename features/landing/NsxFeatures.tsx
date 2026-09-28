import { routes } from "@/config/routes";
import Link from "next/link";
import type { LandingCopy } from "./i18n/landing-copy";

/** Íconos en el mismo orden que `copy.features.items`. */
const FEATURE_ICONS = ["wallet", "scope", "trend", "people", "link", "board"] as const;

function FeatureIcon({ name }: { name: (typeof FEATURE_ICONS)[number] }) {
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

export function NsxFeatures({ copy }: { copy: LandingCopy["features"] }) {
  return (
    <section className="nsx-section nsx-features" id="producto">
      <div className="nsx-container">
        <div className="nsx-section-head">
          <span className="nsx-pill">{copy.pill}</span>
          <h2 className="nsx-h2">{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>

        <div className="nsx-feature-grid">
          {copy.items.map((f, i) => (
            <article key={FEATURE_ICONS[i]} className="nsx-feature-card">
              <div className="nsx-feature-icon" aria-hidden>
                <FeatureIcon name={FEATURE_ICONS[i]} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>

        <div className="nsx-feature-cta">
          <p>{copy.ctaQuestion}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href={routes.register} className="nsx-btn-dark">
              {copy.register} <span aria-hidden>→</span>
            </Link>
            <Link href={routes.login} className="nsx-btn-outline">
              {copy.login}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Ancla de “Proceso” para el menú — flujo operativo simple. */
export function NsxProcess({ copy }: { copy: LandingCopy["process"] }) {
  const steps = copy.steps.map((s, i) => ({ ...s, n: `0${i + 1}` }));

  return (
    <section className="nsx-section nsx-process" id="proceso">
      <div className="nsx-container">
        <div className="nsx-section-head">
          <span className="nsx-pill">{copy.pill}</span>
          <h2 className="nsx-h2">{copy.title}</h2>
          <p>{copy.lead}</p>
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
