"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { OnboardingProgressCard } from "@/features/onboarding/components/OnboardingProgressCard";
import type {
  OnboardingProgress,
  OnboardingStep,
  OnboardingWidgetState,
} from "@/features/onboarding/types/onboarding.types";

interface OnboardingStatusResponse {
  ok: boolean;
  steps: OnboardingStep[];
  totalSteps: number;
  completedSteps: number;
}

interface OnboardingProgressWidgetProps {
  chatOpen: boolean;
  initialProgress: OnboardingProgress;
}

export function OnboardingProgressWidget({
  chatOpen,
  initialProgress,
}: OnboardingProgressWidgetProps) {
  const [widgetState, setWidgetState] = useState<OnboardingWidgetState>("collapsed");
  const [steps, setSteps] = useState<OnboardingStep[]>(initialProgress.steps);
  const [totalSteps, setTotalSteps] = useState(initialProgress.totalSteps);
  const [loadedExpanded, setLoadedExpanded] = useState(false);

  const completedSteps = steps.filter((s) => s.completed).length;

  if (initialProgress.steps.length === 0) {
    return null;
  }

  async function refreshStatus() {
    try {
      const data = await apiClient<OnboardingStatusResponse>("/api/onboarding/status");
      setSteps(data.steps);
      setTotalSteps(data.totalSteps);
    } catch {
      // Mantener datos del servidor si falla el refresh.
    }
  }

  async function handleExpand() {
    setWidgetState("expanded");
    if (!loadedExpanded) {
      setLoadedExpanded(true);
      await refreshStatus();
    }
  }

  async function handleToggleStep(stepId: string) {
    const step = steps.find((item) => item.id === stepId);
    if (!step || step.completed) return;

    try {
      const data = await apiClient<OnboardingStatusResponse>(
        `/api/onboarding/steps/${stepId}/complete`,
        { method: "POST" },
      );
      setSteps(data.steps);
      setTotalSteps(data.totalSteps);
    } catch (error) {
      if (error instanceof ApiClientError) return;
    }
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
        onClick={handleExpand}
        className={cn(
          "flex items-center gap-2 rounded-full bg-[#090b16] px-3 py-2 text-white shadow-xl shadow-black/30 ring-1 ring-white/10 transition-all duration-200 ease-out hover:ring-white/20",
          chatOpen && "-translate-x-2 sm:-translate-x-4",
        )}
        aria-label="Expandir guía de progreso"
      >
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1.5 text-xs font-bold">
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
