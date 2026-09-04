export interface NavItem {
  label: string;
  href: string;
  icon:
    | "overview"
    | "clients"
    | "ad-accounts"
    | "payments"
    | "payments-manual"
    | "cobros"
    | "gastos"
    | "affiliates"
    | "creative-analyzer"
    | "pixels"
    | "support";
}
