"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation } from "@/config/navigation";
import { cn } from "@/lib/cn";

const groups = [
  { title: "Operación", eyebrow: "Centro activo", items: ["/admin/overview", "/admin/organizations", "/admin/users", "/admin/support"] },
  { title: "Finanzas", eyebrow: "Control & cashflow", items: ["/admin/payments", "/admin/refunds", "/admin/ledger", "/admin/reconciliation"] },
  { title: "Growth & Ads", eyebrow: "Escala operativa", items: ["/admin/ad-accounts", "/admin/affiliates", "/admin/creatives"] },
  { title: "Sistema", eyebrow: "Infraestructura", items: ["/admin/webhooks", "/admin/audit", "/admin/integrations", "/admin/settings"] },
];

const hotItems = new Set(["/admin/payments", "/admin/support", "/admin/webhooks"]);

export function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav space-y-5" aria-label="Navegación administrativa">
      {groups.map((group) => {
        const items = adminNavigation.filter((item) => group.items.includes(item.href));
        return (
          <section key={group.title} className="admin-nav-group">
            <div className="mb-2.5 flex items-end justify-between px-3">
              <div>
                <p className="text-[0.61rem] font-black uppercase tracking-[0.24em] text-[var(--admin-info)]">{group.title}</p>
                <p className="mt-0.5 text-[0.63rem] font-bold text-[var(--admin-text-soft)]">{group.eyebrow}</p>
              </div>
              <span className="ml-3 h-px flex-1 translate-y-[-7px] bg-gradient-to-r from-white/[0.12] to-transparent" />
            </div>
            <div className="space-y-1.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const hot = hotItems.has(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "admin-nav-item group relative flex items-center gap-3 overflow-hidden rounded-[1.05rem] px-3 py-2.5 outline-none transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/70",
                      active
                        ? "is-active bg-[var(--admin-accent)] text-[#082131] shadow-[0_10px_22px_rgba(0,0,0,0.18)]"
                        : "text-[var(--admin-text)] hover:-translate-y-0.5 hover:bg-[var(--admin-surface-hover)] hover:shadow-[0_12px_22px_rgba(0,0,0,0.16)]",
                    )}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.12),transparent_44%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    {active ? <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#082131]" /> : null}
                    <span
                      className={cn(
                        "relative grid h-9 w-9 shrink-0 place-items-center rounded-[0.9rem] text-sm font-black transition-all duration-200",
                        active
                          ? "bg-[#082131]/10 text-[#082131]"
                          : "bg-[#12384d] text-[var(--admin-info)] ring-1 ring-white/[0.06] group-hover:scale-[1.03] group-hover:bg-[#173f57] group-hover:text-[var(--admin-accent)]",
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-[0.91rem] font-black leading-5 tracking-[-0.02em]">{item.label}</span>
                      <span className={cn("block truncate text-xs font-semibold", active ? "text-[#114157]" : "text-[var(--admin-text-soft)] group-hover:text-[var(--admin-text-muted)]")}>{item.description}</span>
                    </span>
                    {hot && !active ? <span className="relative h-2 w-2 rounded-full bg-[var(--admin-success)] shadow-[0_0_0_4px_rgba(89,196,147,0.10)]" /> : null}
                    <span className={cn("relative text-sm transition duration-200", active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60")}>›</span>
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
