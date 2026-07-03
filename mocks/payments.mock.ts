import type { PaymentOverview } from "@/types/payment";
import { siteConfig } from "@/config/site";

export const paymentsMock: PaymentOverview = {
  wallet: {
    name: siteConfig.walletName,
    balance: 0,
    currency: "USD",
    lastTopUp: null,
    preferredGateway: "stripe",
  },
  summary: {
    pendingRefunds: 0,
    accountsReadyForAllocation: 0,
  },
  selectedGateway: "stripe",
  gateways: [
    {
      id: "stripe",
      name: "Stripe",
      description: "Tarjetas y pagos globales",
    },
    {
      id: "paypal",
      name: "PayPal",
      description: "Pagos internacionales",
    },
    {
      id: "payoneer",
      name: "Payoneer",
      description: "Transferencias empresariales",
    },
    {
      id: "usdt",
      name: "USDT",
      description: "Stablecoin Tether",
    },
    {
      id: "airwallex",
      name: "Airwallex",
      description: "Pagos cross-border",
    },
  ],
  adAccountsForAllocation: [],
  accountTransactions: [],
  walletTransactions: [],
  refunds: [],
};
