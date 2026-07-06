export interface Wallet {
  id: string;
  name: string;
  balance: number;
  reservedBalance?: number;
  currency: string;
}
