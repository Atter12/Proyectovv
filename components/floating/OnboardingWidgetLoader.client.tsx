"use client";

import { useEffect, useState } from "react";
import { routes } from "@/config/routes";
import { apiClient } from "@/lib/api/api-client.client";
import type { OnboardingProgress } from "@/features/onboarding/types/onboarding.types";
import { OnboardingProgressWidget } from "./OnboardingProgressWidget.client";

interface OnboardingWidgetLoaderProps {
  chatOpen: boolean;
}

interface OnboardingStatusResponse extends OnboardingProgress {
  ok: boolean;
}

export function OnboardingWidgetLoader({ chatOpen }: OnboardingWidgetLoaderProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiClient<OnboardingStatusResponse>(
          routes.api.onboarding.status,
        );
        if (!cancelled && data.completedSteps < data.totalSteps) {
          setProgress({
            steps: data.steps,
            totalSteps: data.totalSteps,
            completedSteps: data.completedSteps,
          });
        }
      } catch {
        // Sin widget si falla la carga.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!progress) return null;

  return (
    <OnboardingProgressWidget chatOpen={chatOpen} initialProgress={progress} />
  );
}
