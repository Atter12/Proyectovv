"use client";

/**
 * Guía corta dentro de una sección: pasos numerados, cuánto tarda, un tip y
 * preguntas frecuentes. Plegada por defecto para no ocupar espacio.
 */
export function HelpGuide({
  summary,
  intro,
  steps,
  time,
  tip,
  faqTitle,
  faq = [],
  className = "mt-3",
}: {
  summary: string;
  intro?: string;
  steps: string[];
  time?: string;
  tip?: string;
  faqTitle?: string;
  faq?: { q: string; a: string }[];
  className?: string;
}) {
  return (
    <details className={`group ${className}`}>
      <summary className="-ml-2 inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-[var(--auth-accent)] outline-none transition-colors hover:bg-[var(--auth-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/30 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 10.75v5" />
          <circle cx="12" cy="7.6" r="0.8" fill="currentColor" stroke="none" />
        </svg>
        <span>{summary}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="m6.5 8 3.5 3.5L13.5 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="mt-2 overflow-hidden rounded-[18px] bg-[#faf8f5] ring-1 ring-[#ece4da]">
        <div className="px-4 pb-4 pt-3.5 sm:px-5">
          {intro ? <p className="mb-3 text-[12.5px] leading-5 text-[#5c564e]">{intro}</p> : null}
          <ol className="space-y-2.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e2a074] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-[13px] leading-5 text-[#1a1714]">{step}</p>
              </li>
            ))}
          </ol>
          {time ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-[#2f6b47] ring-1 ring-[#d7ebdd]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3f9a62]" aria-hidden />
              {time}
            </p>
          ) : null}
          {tip ? <p className="mt-2 text-[12px] leading-5 text-[#8a8177]">{tip}</p> : null}
        </div>

        {faq.length > 0 ? (
          <div className="border-t border-[#ece4da] px-4 py-3 sm:px-5">
            {faqTitle ? <p className="text-[12px] font-semibold text-[#5c564e]">{faqTitle}</p> : null}
            <div className="mt-1.5 divide-y divide-[#ece4da]">
              {faq.map((item) => (
                <details key={item.q} className="group/faq py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-[#1a1714] [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden className="text-[#a89c90] transition group-open/faq:rotate-180">⌄</span>
                  </summary>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-[#5c564e]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
