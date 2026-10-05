export type NavItemKey =
  | "overview"
  | "clients"
  | "adAccounts"
  | "payments"
  | "paymentsManual"
  | "paymentsProfit"
  | "paymentsMissingCobros"
  | "debtLinks"
  | "prepagoMonitor"
  | "cobros"
  | "gastos"
  | "affiliates"
  | "alliances"
  | "registrationContracts"
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
    | "monitor"
    | "cobros"
    | "gastos"
    | "affiliates"
    | "contracts"
    | "creative-analyzer"
    | "pixels"
    | "profit"
    | "assistant"
    | "education"
    | "support";
}
