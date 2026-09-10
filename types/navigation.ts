export type NavItemKey =
  | "overview"
  | "clients"
  | "adAccounts"
  | "payments"
  | "paymentsManual"
  | "paymentsProfit"
  | "cobros"
  | "gastos"
  | "affiliates"
  | "creativeAnalyzer"
  | "pixels"
  | "profit"
  | "support";

export interface NavItem {
  /** Translation key under the `nav` namespace. */
  key: NavItemKey;
  href: string;
  icon:
    | "overview"
    | "clients"
    | "ad-accounts"
    | "payments"
    | "payments-manual"
    | "payments-profit"
    | "cobros"
    | "gastos"
    | "affiliates"
    | "creative-analyzer"
    | "pixels"
    | "profit"
    | "support";
}
