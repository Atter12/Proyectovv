"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { onboardingMock } from "@/features/onboarding/mocks/onboarding.mock";
import { OnboardingProgressCard } from "@/features/onboarding/components/OnboardingProgressCard";
import type { OnboardingStep, OnboardingWidgetState } from "@/features/onboarding/types/onboarding.types";

interface OnboardingProgressWidgetProps {
  chatOpen: boolean;
}

export function OnboardingProgressWidget({ chatOpen }: OnboardingProgressWidgetProps) {
  const [widgetState, setWidgetState] = useState<OnboardingWidgetState>("collapsed");
  const [steps, setSteps] = useState<OnboardingStep[]>(onboardingMock.steps);

  const completedSteps = steps.filter((s) => s.completed).length;
  const totalSteps = onboardingMock.totalSteps;

  function handleToggleStep(stepId: string) {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, completed: !step.completed } : step,
      ),
    );
  }

  if (widgetState === "closed") {
    return (
      <button
        type="button"
        onClick={() => setWidgetState("collapsed")}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-full bg-[#090b16]/80 px-3 text-xs text-white/70 shadow-md ring-1 ring-white/10 transition-all duration-200 ease-out hover:text-white",
          chatOpen && "mr-2 sm:mr-0",
        )}
        aria-label="Mostrar guía de progreso"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Guía
      </button>
    );
  }

  if (widgetState === "collapsed") {
    return (
      <button
        type="button"
        onClick={() => setWidgetState("expanded")}
        className={cn(
          "flex items-center gap-2 rounded-full bg-[#090b16] px-3 py-2 text-white shadow-xl shadow-black/30 ring-1 ring-white/10 transition-all duration-200 ease-out hover:ring-white/20",
          chatOpen && "-translate-x-2 sm:-translate-x-4",
        )}
        aria-label="Expandir guía de progreso"
      >
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#4056ff] px-1.5 text-xs font-bold">
          {completedSteps}/{totalSteps}
        </span>
        <span className="text-xs font-medium">Empieza con Default</span>
        <svg className="h-3.5 w-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "transition-all duration-200 ease-out",
        chatOpen && "-translate-x-2 sm:-translate-x-4",
      )}
    >
      <OnboardingProgressCard
        completedSteps={completedSteps}
        totalSteps={totalSteps}
        steps={steps}
        onToggleStep={handleToggleStep}
        onClose={() => setWidgetState("collapsed")}
      />
    </div>
  );
}
