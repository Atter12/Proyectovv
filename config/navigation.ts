import { routes } from "./routes";
import type { NavItem } from "@/types/navigation";

export const mainNavigation: NavItem[] = [
  { label: "Descripción general", href: routes.overview, icon: "overview" },
  { label: "Mis cuentas publicitarias", href: routes.adAccounts, icon: "ad-accounts" },
  { label: "Pago", href: routes.payments, icon: "payments" },
  { label: "Programa de afiliados", href: routes.affiliates, icon: "affiliates" },
  { label: "Analizador creativo", href: routes.creativeAnalyzer, icon: "creative-analyzer" },
];
