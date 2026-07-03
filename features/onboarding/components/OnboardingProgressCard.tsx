import type { OnboardingStep } from "../types/onboarding.types";

interface OnboardingProgressCardProps {
  completedSteps: number;
  totalSteps: number;
  steps: OnboardingStep[];
  onToggleStep: (stepId: string) => void;
  onClose: () => void;
}

export function OnboardingProgressCard({
  completedSteps,
  totalSteps,
  steps,
  onToggleStep,
  onClose,
}: OnboardingProgressCardProps) {
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#090b16] p-4 shadow-xl shadow-black/30 ring-1 ring-white/10 transition-all duration-200 ease-out">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {completedSteps}/{totalSteps} Empieza con Default
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Cerrar guía de progreso"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#4056ff] transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onToggleStep(step.id)}
              className="flex w-full items-start gap-3 text-left transition-opacity hover:opacity-80"
            >
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  step.completed
                    ? "border-[#4056ff] bg-[#4056ff]"
                    : "border-white/30 bg-transparent"
                }`}
              >
                {step.completed && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <span
                className={`text-sm leading-tight ${
                  step.completed ? "text-white/60 line-through" : "text-white/90"
                }`}
              >
                {step.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
