import type { AdAccount } from "@/types/ad-account";
import type { Wallet } from "@/types/wallet";
import { adAccountsMock } from "./ad-accounts.mock";
import { walletMock } from "./wallet.mock";
import { userMock } from "./user.mock";

export interface DashboardMetrics {
  todaySpend: number;
  referralEarnings: number;
  referralMembers: number;
  totalAdAccounts: number;
}

export interface DashboardOverview {
  user: typeof userMock;
  wallet: Wallet;
  metrics: DashboardMetrics;
  adAccounts: AdAccount[];
  onboardingSteps: { step: number; title: string; description: string }[];
}

export const dashboardMock: DashboardOverview = {
  user: userMock,
  wallet: walletMock,
  metrics: {
    todaySpend: 0,
    referralEarnings: 0,
    referralMembers: 0,
    totalAdAccounts: 0,
  },
  adAccounts: adAccountsMock,
  onboardingSteps: [
    {
      step: 1,
      title: "Crea tu cuenta publicitaria",
      description: "Configura tu primera cuenta para empezar a publicar.",
    },
    {
      step: 2,
      title: "Agrega saldo a tu Cartera Default",
      description: "Recarga fondos mediante tu pasarela preferida.",
    },
    {
      step: 3,
      title: "Asigna saldo a la cuenta publicitaria",
      description: "Distribuye presupuesto entre tus cuentas activas.",
    },
  ],
};
