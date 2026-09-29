import type { CSSProperties } from "react";
import { NsxReveal } from "./NsxReveal.client";
import type { LandingCopy } from "./i18n/landing-copy";

const SCORE = 86;
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** Analizador de creativos con IA: el anillo y las barras se llenan al entrar en pantalla. */
export function NsxAiSpotlight({ copy }: { copy: LandingCopy["ai"] }) {
  const m = copy.mock;
  const subScores = [
    { label: m.clarity, value: 88 },
    { label: m.brand, value: 79 },
    { label: m.compliance, value: 92 },
  ];

  return (
    <section className="nsx-ai" id="ia">
      <div className="nsx-container nsx-ai-grid">
        <div className="nsx-ai-copy">
          <span className="nsx-pill nsx-pill-on-dark">{copy.pill}</span>
          <h2 className="nsx-h2 nsx-h2-on-dark">{copy.title}</h2>
          <p className="nsx-ai-lead">{copy.body}</p>
          <ul className="nsx-ai-bullets">
            {copy.bullets.map((b) => (
              <li key={b}>
                <span aria-hidden>✦</span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <NsxReveal className="nsx-ai-card-wrap" delayMs={60}>
          <div className="nsx-ai-card" aria-hidden>
            <div className="nsx-ai-file">
              <span className="nsx-ai-file-icon">▶</span>
              <span>{m.file}</span>
              <span className="nsx-ai-wave">
                {Array.from({ length: 14 }, (_, i) => (
                  <span key={i} style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              </span>
            </div>

            <div className="nsx-ai-score">
              <svg viewBox="0 0 120 120" className="nsx-ai-ring">
                <circle cx="60" cy="60" r={RING_R} className="nsx-ai-ring-bg" />
                <circle
                  cx="60"
                  cy="60"
                  r={RING_R}
                  className="nsx-ai-ring-fg"
                  style={
                    {
                      strokeDasharray: RING_C,
                      "--ring-c": RING_C,
                      "--ring-offset": RING_C * (1 - SCORE / 100),
                    } as CSSProperties
                  }
                />
              </svg>
              <div className="nsx-ai-score-text">
                <strong>{SCORE}</strong>
                <span>{m.overall}</span>
              </div>
            </div>

            <ul className="nsx-ai-subs">
              {subScores.map((s, i) => (
                <li key={s.label}>
                  <span>{s.label}</span>
                  <span className="nsx-ai-subbar">
                    <span style={{ width: `${s.value}%`, animationDelay: `${300 + i * 120}ms` }} />
                  </span>
                  <strong>{s.value}</strong>
                </li>
              ))}
            </ul>

            <ul className="nsx-ai-notes">
              <li className="is-good">✓ {m.hook}</li>
              <li className="is-risk">! {m.risk}</li>
              <li className="is-tip">→ {m.tip}</li>
            </ul>
          </div>
        </NsxReveal>
      </div>
    </section>
  );
}
