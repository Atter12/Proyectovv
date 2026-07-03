export type PaymentGatewayId =
  | "stripe"
  | "paypal"
  | "payoneer"
  | "usdt"
  | "airwallex";

export type PaymentTabKey =
  | "assignment"
  | "account-tx"
  | "wallet-tx"
  | "refunds";

export interface PaymentGateway {
  id: PaymentGatewayId;
  name: string;
  description: string;
}

export interface WalletOverview {
  name: string;
  balance: number;
  currency: string;
  lastTopUp: string | null;
  preferredGateway: PaymentGatewayId;
}

export interface PaymentAccountAllocation {
  id: string;
  name: string;
  status: string;
  balance: number;
  autoRecharge: boolean;
  thresholdInfo: string;
}

export interface TransactionHistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentOverview {
  wallet: WalletOverview;
  summary: {
    pendingRefunds: number;
    accountsReadyForAllocation: number;
  };
  selectedGateway: PaymentGatewayId;
  gateways: PaymentGateway[];
  adAccountsForAllocation: PaymentAccountAllocation[];
  accountTransactions: TransactionHistoryItem[];
  walletTransactions: TransactionHistoryItem[];
  refunds: TransactionHistoryItem[];
}
