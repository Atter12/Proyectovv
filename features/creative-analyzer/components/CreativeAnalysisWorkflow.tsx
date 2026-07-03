import { Card } from "@/components/ui/Card";
import type { CreativeWorkflowStep } from "@/types/creative-analyzer";

function StepIcon({ step }: { step: number }) {
  const className = "h-5 w-5";

  switch (step) {
    case 1:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      );
    case 2:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      );
    case 3:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      );
  }
}

interface CreativeAnalysisWorkflowProps {
  steps: CreativeWorkflowStep[];
}

export function CreativeAnalysisWorkflow({ steps }: CreativeAnalysisWorkflowProps) {
  return (
    <section id="creative-workflow" className="scroll-mt-24">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#0f172a]">
          Cómo analiza tus creatividades
        </h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Un flujo simple para convertir señales creativas en decisiones
          accionables.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <Card
            key={step.id}
            className="relative min-w-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#4056ff]/20 hover:shadow-md"
          >
            {index < steps.length - 1 && (
              <div className="absolute -right-2 top-1/2 z-10 hidden h-px w-4 bg-gradient-to-r from-[#4056ff]/40 to-transparent xl:block" />
            )}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-sm font-bold text-white">
                {step.step}
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#64748b]">
                <StepIcon step={step.step} />
              </span>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-[#0f172a]">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
              {step.description}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
