/** Ayuda contextual y compacta sobre el recorrido del saldo. */
export function PaymentsMoneyFlowGuide() {
  return (
    <details className="group mt-3">
      <summary className="-ml-2 inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-[var(--auth-accent)] outline-none transition-colors hover:bg-[var(--auth-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/30 [&::-webkit-details-marker]:hidden">
        <InfoIcon />
        <span>¿Cómo funciona la recarga?</span>
        <ChevronIcon />
      </summary>

      <div className="mt-2 overflow-hidden rounded-xl border border-[var(--auth-divider)] bg-[var(--auth-surface-muted)]/45">
        <p className="px-4 pt-3 text-[12px] leading-5 text-[var(--auth-text-muted)] sm:px-5">
          El saldo pasa por tu cartera Holistic antes de llegar a TikTok.
        </p>
        <ol className="mt-1 grid divide-y divide-[var(--auth-divider)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <FlowStep
            number="1"
            title="Recargá la cartera"
            description="Elegí el monto y el método de pago."
          />
          <FlowStep
            number="2"
            title="Asigná el saldo"
            description="Elegí qué cuenta de TikTok lo recibe."
          />
          <FlowStep
            number="3"
            title="Usalo en campañas"
            description="El saldo queda disponible dentro de TikTok."
          />
        </ol>
      </div>
    </details>
  );
}

function FlowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3 px-4 py-3 sm:px-5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--auth-accent)] text-[11px] font-bold text-white">
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[var(--auth-text)]">{title}</p>
        <p className="mt-0.5 text-[12px] leading-[1.45] text-[var(--auth-text-muted)]">
          {description}
        </p>
      </div>
    </li>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 10.75v5" />
      <circle cx="12" cy="7.6" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="m6.5 8 3.5 3.5L13.5 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
