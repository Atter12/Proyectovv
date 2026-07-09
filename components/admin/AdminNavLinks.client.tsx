"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminNavSignal } from "@/components/admin/AdminNavSignal";
import { adminNavigation } from "@/config/navigation";
import type { AdminNavSignals } from "@/lib/admin/data";
import { cn } from "@/lib/cn";

const groups = [
  { title: "Operación", items: ["/admin/overview", "/admin/organizations", "/admin/users", "/admin/support"] },
  { title: "Finanzas", items: ["/admin/payments", "/admin/refunds", "/admin/ledger", "/admin/reconciliation"] },
  { title: "Growth & Ads", items: ["/admin/ad-accounts", "/admin/affiliates", "/admin/creatives"] },
  { title: "Sistema", items: ["/admin/webhooks", "/admin/audit", "/admin/integrations", "/admin/settings"] },
];

const signalTitles: Partial<Record<string, string>> = {
  "/admin/payments": "Pagos manuales pendientes",
  "/admin/support": "Tickets abiertos",
  "/admin/webhooks": "Webhooks fallidos",
};

function getSignalCount(href: string, signals?: AdminNavSignals): number {
  if (!signals) return 0;
  if (href === "/admin/payments") return signals["/admin/payments"];
  if (href === "/admin/support") return signals["/admin/support"];
  if (href === "/admin/webhooks") return signals["/admin/webhooks"];
  return 0;
}

export function AdminNavLinks({
  onNavigate,
  navSignals,
}: {
  onNavigate?: () => void;
  navSignals?: AdminNavSignals;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-1" aria-label="Navegación administrativa">
      {groups.map((group, groupIndex) => {
        const items = adminNavigation.filter((item) => group.items.includes(item.href));

        return (
          <section
            key={group.title}
            className={cn("admin-nav-group", groupIndex > 0 ? "admin-nav-group--divided" : "")}
          >
            <p className="mb-1.5 px-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-soft)]">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const signalCount = getSignalCount(item.href, navSignals);
                const signalTitle = signalTitles[item.href] ?? "Requiere revisión";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.description}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "admin-nav-link group relative flex min-h-[2.25rem] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/30",
                      active ? "admin-nav-link--active font-semibold" : "",
                    )}
                  >
                    <span
                      className={cn(
                        "admin-nav-link__icon grid h-7 w-7 shrink-0 place-items-center rounded-md text-[0.72rem] leading-none transition-colors duration-150 ease-out",
                      )}
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {!active ? <AdminNavSignal count={signalCount} title={signalTitle} /> : null}
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
