/** Proveedores reales alineados al enum payment_provider de Supabase. */
export type PaymentGatewayId =
  | "stripe"
  | "culqi"
  | "mercadopago"
  | "manual";

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
  reservedBalance?: number;
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

export const PAYMENT_GATEWAY_IDS: PaymentGatewayId[] = [
  "stripe",
  "culqi",
  "mercadopago",
  "manual",
];

export function isPaymentGatewayId(value: string): value is PaymentGatewayId {
  return PAYMENT_GATEWAY_IDS.includes(value as PaymentGatewayId);
}
