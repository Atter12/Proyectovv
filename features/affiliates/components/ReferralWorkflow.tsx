import { Card } from "@/components/ui/Card";
import type { ReferralStep } from "@/types/affiliate";

function StepIcon({ step }: { step: number }) {
  const className = "h-4 w-4";

  switch (step) {
    case 1:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      );
    case 2:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008H12.75V8.25zm0 3h.008v.008H12.75v-.008zm0 3h.008v.008H12.75v-.008z" />
        </svg>
      );
    case 3:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

interface ReferralWorkflowProps {
  steps: ReferralStep[];
}

export function ReferralWorkflow({ steps }: ReferralWorkflowProps) {
  return (
    <Card>
      <div className="mb-6">
        <h3 className="text-base font-semibold text-[#0f172a]">Cómo funciona</h3>
        <p className="mt-1 text-sm text-[#64748b]">
          Completa estos pasos para empezar a generar comisiones.
        </p>
      </div>

      <ol className="relative space-y-0">
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex gap-4 pb-5 last:pb-0">
            {index < steps.length - 1 && (
              <div className="absolute left-5 top-10 h-[calc(100%-8px)] w-px bg-gradient-to-b from-[var(--brand-primary)]/30 to-[var(--brand-primary-deep)]/10" />
            )}
            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-deep)] text-sm font-bold text-white shadow-sm shadow-indigo-500/20">
              {step.step}
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-[#e5e7eb] bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#64748b]">
                    <StepIcon step={step.step} />
                  </span>
                  <p className="text-sm font-semibold text-[#0f172a]">{step.title}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    step.status === "available"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {step.status === "available" ? "Disponible" : "Pendiente"}
                </span>
              </div>
              <p className="mt-2 pl-9 text-sm leading-relaxed text-[#64748b]">
                {step.description}
              </p>
              {step.optionalAction && (
                <p className="mt-2 pl-9 text-xs font-medium text-[var(--brand-primary)]">
                  → {step.optionalAction}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
