export interface NavItem {
  label: string;
  href: string;
  icon:
    | "overview"
    | "clients"
    | "ad-accounts"
    | "payments"
    | "cobros"
    | "gastos"
    | "affiliates"
    | "creative-analyzer"
    | "support";
}
