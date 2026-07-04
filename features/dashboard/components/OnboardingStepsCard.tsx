import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/routes";

interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  completed?: boolean;
}

interface OnboardingStepsCardProps {
  steps: OnboardingStep[];
}

function StepIcon({ step }: { step: number }) {
  const className = "h-4 w-4";

  switch (step) {
    case 1:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 2:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      );
  }
}

export function OnboardingStepsCard({ steps }: OnboardingStepsCardProps) {
  const completed = steps.filter((step) => step.completed).length;
  const total = steps.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Card className="h-full transition-all duration-200" elevated>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#0f172a]">Pasos iniciales</h3>
          <p className="mt-1 text-sm text-[#64748b]">
            Completa estos pasos para activar tu primera campaña.
          </p>
        </div>
        <Badge variant="info" className="shrink-0">
          {completed}/{total} completado
        </Badge>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#4056ff] to-[#7c3aed] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="relative space-y-0">
        {steps.map((step, index) => (
          <li key={step.step} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 && (
              <div className="absolute left-4 top-9 h-[calc(100%-12px)] w-px bg-slate-200" />
            )}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#4056ff]/20 bg-[#4056ff]/5 text-sm font-semibold text-[#4056ff]">
              {step.step}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#64748b]">
                    <StepIcon step={step.step} />
                  </span>
                  <p className="text-sm font-semibold text-[#0f172a]">{step.title}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    step.completed
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {step.completed ? "Completado" : "Pendiente"}
                </span>
              </div>
              <p className="mt-1.5 pl-9 text-sm text-[#64748b]">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <Link
          href={routes.adAccounts}
          className="inline-flex h-10 items-center rounded-xl bg-[#4056ff] px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#4056ff]/90 hover:shadow-md"
        >
          Crear cuenta publicitaria
        </Link>
        <Link
          href={routes.affiliates}
          className="text-sm font-medium text-[#4056ff] transition-colors hover:text-[#7c3aed] hover:underline"
        >
          Ver guía rápida
        </Link>
      </div>
    </Card>
  );
}
