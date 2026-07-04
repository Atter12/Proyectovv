import type { PaymentOverview } from "@/types/payment";
import { siteConfig } from "@/config/site";

export const paymentsMock: PaymentOverview = {
  wallet: {
    name: siteConfig.walletName,
    balance: 0,
    currency: "USD",
    lastTopUp: null,
    preferredGateway: "manual",
  },
  summary: {
    pendingRefunds: 0,
    accountsReadyForAllocation: 0,
  },
  selectedGateway: "manual",
  gateways: [
    {
      id: "stripe",
      name: "Stripe",
      description: "Tarjetas y pagos globales",
    },
    {
      id: "culqi",
      name: "Culqi",
      description: "Pagos con tarjeta en Perú",
    },
    {
      id: "mercadopago",
      name: "Mercado Pago",
      description: "Pagos en Latinoamérica",
    },
    {
      id: "manual",
      name: "Pago manual",
      description: "Transferencia o depósito revisado por el equipo",
    },
  ],
  adAccountsForAllocation: [],
  accountTransactions: [],
  walletTransactions: [],
  refunds: [],
};
