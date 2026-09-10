import { routes } from "./routes";
import type { NavItem } from "@/types/navigation";

export const mainNavigation: NavItem[] = [
  { key: "overview", href: routes.overview, icon: "overview" },
  { key: "clients", href: routes.clientes, icon: "clients" },
  { key: "adAccounts", href: routes.adAccounts, icon: "ad-accounts" },
  { key: "payments", href: routes.payments, icon: "payments" },
  { key: "profit", href: routes.profit, icon: "profit" },
  {
    key: "paymentsManual",
    href: routes.paymentsManual,
    icon: "payments-manual",
  },
  {
    key: "paymentsProfit",
    href: routes.paymentsProfit,
    icon: "payments-profit",
  },
  { key: "cobros", href: routes.cobros, icon: "cobros" },
  { key: "affiliates", href: routes.affiliates, icon: "affiliates" },
  {
    key: "creativeAnalyzer",
    href: routes.creativeAnalyzer,
    icon: "creative-analyzer",
  },
  { key: "pixels", href: routes.pixels, icon: "pixels" },
  { key: "support", href: routes.support, icon: "support" },
];

export interface AdminNavItem {
  label: string;
  href: string;
  description: string;
  icon: string;
}

/** Admin UI stays Spanish-only in v1 (out of scope for next-intl). */
export const adminNavigation: AdminNavItem[] = [
  { label: "Resumen", href: "/admin/overview", description: "KPIs operativos", icon: "◇" },
  { label: "Clientes", href: "/admin/clientes", description: "Elegir cliente y ver solo lo suyo", icon: "◎" },
  { label: "Organizaciones", href: "/admin/organizations", description: "Ficha operativa CRM", icon: "⌂" },
  { label: "Usuarios", href: "/admin/users", description: "Perfiles y membresías", icon: "☷" },
  { label: "Pagos manuales", href: "/admin/payments", description: "Vouchers y abonos", icon: "$" },
  { label: "Reembolsos", href: "/admin/refunds", description: "Solicitudes del cliente", icon: "↩" },
  { label: "Cuentas Ads", href: "/admin/ad-accounts", description: "Estados y límites", icon: "▣" },
  { label: "Soporte", href: "/admin/support", description: "Tickets y mensajes", icon: "✦" },
  { label: "Afiliados", href: "/admin/affiliates", description: "Códigos y comisiones", icon: "↗" },
  { label: "Creativos", href: "/admin/creatives", description: "Uploads y jobs IA", icon: "✺" },
  { label: "Ledger", href: "/admin/ledger", description: "Journals y entries", icon: "≡" },
  { label: "Conciliación", href: "/admin/reconciliation", description: "Runs e inconsistencias", icon: "⇄" },
  { label: "Webhooks", href: "/admin/webhooks", description: "Eventos externos", icon: "⌁" },
  { label: "Auditoría", href: "/admin/audit", description: "Trazabilidad", icon: "◷" },
  { label: "Integraciones", href: "/admin/integrations", description: "Conexiones y API keys", icon: "⛓" },
  { label: "Configuración", href: "/admin/settings", description: "Estado del admin", icon: "⚙" },
];
