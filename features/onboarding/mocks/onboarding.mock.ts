import type { OnboardingProgress } from "../types/onboarding.types";

export const onboardingMock: OnboardingProgress = {
  totalSteps: 3,
  completedSteps: 0,
  steps: [
    {
      id: "create-ad-account",
      label: "Crea tu cuenta publicitaria",
      completed: false,
    },
    {
      id: "add-wallet-balance",
      label: "Agrega saldo a tu Cartera Default",
      completed: false,
    },
    {
      id: "allocate-balance",
      label: "Asigna saldo a la cuenta publicitaria",
      completed: false,
    },
  ],
};
