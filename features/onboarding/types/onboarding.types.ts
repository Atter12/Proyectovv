export type OnboardingStepId =
  | "create-ad-account"
  | "add-wallet-balance"
  | "allocate-balance";

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  completed: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  totalSteps: number;
  completedSteps: number;
}

export type OnboardingWidgetState = "collapsed" | "expanded" | "closed";
