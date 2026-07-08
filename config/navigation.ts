import { routes } from "./routes";
import type { NavItem } from "@/types/navigation";

export const mainNavigation: NavItem[] = [
  { label: "Descripción general", href: routes.overview, icon: "overview" },
  { label: "Mis cuentas publicitarias", href: routes.adAccounts, icon: "ad-accounts" },
  { label: "Pago", href: routes.payments, icon: "payments" },
  { label: "Programa de afiliados", href: routes.affiliates, icon: "affiliates" },
  { label: "Analizador creativo", href: routes.creativeAnalyzer, icon: "creative-analyzer" },
];

export interface AdminNavItem {
  label: string;
  href: string;
  description: string;
  icon: string;
}

export const adminNavigation: AdminNavItem[] = [
  { label: "Resumen", href: "/admin/overview", description: "KPIs operativos", icon: "◇" },
  { label: "Organizaciones", href: "/admin/organizations", description: "Clientes y carteras", icon: "◎" },
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
