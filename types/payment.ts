export type PaymentGatewayId =
  | "stripe"
  | "paypal"
  | "payoneer"
  | "usdt"
  | "airwallet";

export interface PaymentGateway {
  id: PaymentGatewayId;
  name: string;
  description: string;
}

export interface PaymentTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentOverview {
  wallet: {
    name: string;
    balance: number;
    currency: string;
  };
  gateways: PaymentGateway[];
  accountAssignments: never[];
  accountTransactions: never[];
  walletTransactions: never[];
  refunds: never[];
}
