import type { LandingCopy } from "./i18n/landing-copy";

/** Franja animada con los métodos de recarga (se duplica la lista para el loop). */
export function NsxPayMarquee({ copy }: { copy: LandingCopy["payments"] }) {
  const loop = [...copy.methods, ...copy.methods];

  return (
    <section className="nsx-pay" aria-label={copy.label}>
      <div className="nsx-container nsx-pay-inner">
        <p className="nsx-pay-label">{copy.label}</p>
        <div className="nsx-pay-track-wrap">
          <ul className="nsx-pay-track">
            {loop.map((method, i) => (
              <li
                key={`${method}-${i}`}
                className="nsx-pay-chip"
                aria-hidden={i >= copy.methods.length ? true : undefined}
              >
                <span className="nsx-pay-dot" aria-hidden />
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
