"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation } from "@/config/navigation";
import { cn } from "@/lib/cn";

const groups = [
  { title: "Operación", items: ["/admin/overview", "/admin/organizations", "/admin/users", "/admin/support"] },
  { title: "Finanzas", items: ["/admin/payments", "/admin/refunds", "/admin/ledger", "/admin/reconciliation"] },
  { title: "Growth & Ads", items: ["/admin/ad-accounts", "/admin/affiliates", "/admin/creatives"] },
  { title: "Sistema", items: ["/admin/webhooks", "/admin/audit", "/admin/integrations", "/admin/settings"] },
];

const signalItems = new Set(["/admin/payments", "/admin/support", "/admin/webhooks"]);

export function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav admin-nav--operational space-y-3.5" aria-label="Navegación administrativa">
      {groups.map((group) => {
        const items = adminNavigation.filter((item) => group.items.includes(item.href));
        return (
          <section key={group.title} className="admin-nav-group">
            <p className="mb-1 px-2 text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[var(--admin-text-soft)]">{group.title}</p>
            <div className="space-y-px">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const hasSignal = signalItems.has(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.description}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "admin-nav-item group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/50",
                      active
                        ? "is-active bg-[var(--admin-surface-hover)] font-semibold text-[var(--admin-text)]"
                        : "font-medium text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded text-[0.7rem] leading-none",
                        active ? "text-[var(--admin-accent)]" : "text-[var(--admin-info)] group-hover:text-[var(--admin-accent)]",
                      )}
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {hasSignal && !active ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--admin-warning)]" title="Requiere revisión" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
