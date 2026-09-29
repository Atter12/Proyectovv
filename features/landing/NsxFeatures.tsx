import { routes } from "@/config/routes";
import Link from "next/link";
import type { LandingCopy } from "./i18n/landing-copy";
import { NsxReveal } from "./NsxReveal.client";

/** Íconos en el mismo orden que `copy.extras.items`. */
const FEATURE_ICONS = ["receipt", "bell", "gift", "bag", "people", "link"] as const;

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
    case "receipt":
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
          <path d="M3.5 13h17M12 9v11" />
          <path d="M12 9c-1.5-3-5-3.5-5-1.2C7 9 9.5 9 12 9Zm0 0c1.5-3 5-3.5 5-1.2C17 9 14.5 9 12 9Z" />
        </svg>
      );
    case "bag":
      return (
        <svg {...common}>
          <path d="M5 8h14l-1 12H6L5 8Z" />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
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
    default:
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
        </svg>
      );
  }
}

export function NsxFeatures({ copy }: { copy: LandingCopy["extras"] }) {
  return (
    <section className="nsx-section nsx-features" id="extras">
      <div className="nsx-container">
        <div className="nsx-section-head">
          <span className="nsx-pill">{copy.pill}</span>
          <h2 className="nsx-h2">{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>

        <div className="nsx-feature-grid">
          {copy.items.map((f, i) => (
            <NsxReveal key={FEATURE_ICONS[i]} as="article" className="nsx-feature-card" delayMs={(i % 3) * 80}>
              <div className="nsx-feature-icon" aria-hidden>
                <FeatureIcon name={FEATURE_ICONS[i]} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </NsxReveal>
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

/** Ancla de “Proceso” para el menú — de cero a la primera campaña. */
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
          {steps.map((s, i) => (
            <NsxReveal key={s.n} as="li" className="nsx-process-card" delayMs={i * 90}>
              <span className="nsx-process-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </NsxReveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
