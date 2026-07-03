import type { PaymentOverview } from "@/types/payment";
import { siteConfig } from "@/config/site";

export const paymentsMock: PaymentOverview = {
  wallet: {
    name: siteConfig.walletName,
    balance: 0,
    currency: "USD",
  },
  gateways: [
    { id: "stripe", name: "Stripe", description: "Tarjeta de crédito y débito" },
    { id: "paypal", name: "PayPal", description: "Pagos internacionales" },
    { id: "payoneer", name: "Payoneer", description: "Transferencias globales" },
    { id: "usdt", name: "USDT", description: "Criptomoneda estable" },
    { id: "airwallet", name: "Airwallet", description: "Billetera digital" },
  ],
  accountAssignments: [],
  accountTransactions: [],
  walletTransactions: [],
  refunds: [],
};
