import { AdminNavLinks } from "@/components/admin/AdminNavLinks.client";
import { AdminSidebarBrand } from "@/components/admin/AdminSidebarBrand";
import { AdminSidebarUserSession } from "@/components/admin/AdminSidebarUserSession";
import type { AdminSession } from "@/lib/admin/auth";
import type { AdminNavSignals } from "@/lib/admin/data";

type AdminSidebarPanelProps = {
  admin: AdminSession;
  navSignals?: AdminNavSignals;
  onNavigate?: () => void;
};

export function AdminSidebarPanel({ admin, navSignals, onNavigate }: AdminSidebarPanelProps) {
  return (
    <div className="admin-sidebar-shell flex h-full flex-col">
      <AdminSidebarBrand onNavigate={onNavigate} />

      <div className="admin-nav-scroll min-h-0 flex-1 overflow-y-auto pb-3">
        <AdminNavLinks onNavigate={onNavigate} navSignals={navSignals} />
      </div>

      <AdminSidebarUserSession admin={admin} />
    </div>
  );
}
