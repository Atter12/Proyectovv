import { AdminNavLinks } from "@/components/admin/AdminNavLinks.client";
import { AdminSidebarBrand } from "@/components/admin/AdminSidebarBrand";
import { AdminSidebarUserSession } from "@/components/admin/AdminSidebarUserSession";
import type { AdminSession } from "@/lib/admin/auth";

type AdminSidebarPanelProps = {
  admin: AdminSession;
  onNavigate?: () => void;
};

export function AdminSidebarPanel({ admin, onNavigate }: AdminSidebarPanelProps) {
  return (
    <div className="admin-sidebar-shell flex h-full flex-col">
      <AdminSidebarBrand onNavigate={onNavigate} />

      <div className="admin-nav-scroll min-h-0 flex-1 overflow-y-auto pb-2">
        <AdminNavLinks onNavigate={onNavigate} />
      </div>

      <AdminSidebarUserSession admin={admin} />
    </div>
  );
}
