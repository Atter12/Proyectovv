export type NavItemKey =
  | "overview"
  | "clients"
  | "adAccounts"
  | "payments"
  | "paymentsManual"
  | "paymentsProfit"
  | "paymentsMissingCobros"
  | "debtLinks"
  | "cobros"
  | "gastos"
  | "affiliates"
  | "alliances"
  | "creativeAnalyzer"
  | "pixels"
  | "profit"
  | "assistant"
  | "education"
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
    | "payments-missing-cobros"
    | "debt-links"
    | "cobros"
    | "gastos"
    | "affiliates"
    | "alliances"
    | "creative-analyzer"
    | "pixels"
    | "profit"
    | "assistant"
    | "education"
    | "support";
}
