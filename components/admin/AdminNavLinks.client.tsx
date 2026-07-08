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
    <nav className="admin-nav space-y-4" aria-label="Navegación administrativa">
      {groups.map((group) => {
        const items = adminNavigation.filter((item) => group.items.includes(item.href));
        return (
          <section key={group.title} className="admin-nav-group relative pl-4">
            <span aria-hidden className="admin-nav-branch absolute left-[0.42rem] top-8 bottom-1 w-px" />
            <div className="mb-1.5 flex items-end justify-between px-2">
              <div>
                <p className="text-[0.6rem] font-black uppercase tracking-[0.22em] text-[var(--admin-info)]">{group.title}</p>
                <p className="mt-0.5 text-[0.61rem] font-bold text-[var(--admin-text-soft)]">{group.eyebrow}</p>
              </div>
              <span className="ml-3 h-px flex-1 translate-y-[-7px] bg-gradient-to-r from-white/[0.08] to-transparent" />
            </div>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const hot = hotItems.has(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "admin-nav-item group relative flex items-center gap-2.5 rounded-[0.9rem] px-2.5 py-1.5 outline-none transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/60",
                      active
                        ? "is-active bg-[var(--admin-accent)] text-[#082131]"
                        : "text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "admin-branch-node absolute -left-[0.94rem] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border transition-all duration-200",
                        active ? "border-[var(--admin-accent)] bg-[var(--admin-accent)]" : "border-white/[0.16] bg-[#0e2a3a] group-hover:border-[var(--admin-info)]/70",
                      )}
                    />
                    <span
                      className={cn(
                        "relative grid h-8 w-8 shrink-0 place-items-center rounded-[0.75rem] text-sm font-black transition-all duration-200",
                        active
                          ? "bg-[#082131]/10 text-[#082131]"
                          : "bg-[#12384d] text-[var(--admin-info)] ring-1 ring-white/[0.05] group-hover:bg-[#173f57] group-hover:text-[var(--admin-accent)]",
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-[0.88rem] font-black leading-4 tracking-[-0.02em]">{item.label}</span>
                      <span className={cn("block truncate text-[0.68rem] font-semibold leading-4", active ? "text-[#114157]" : "text-[var(--admin-text-soft)] group-hover:text-[var(--admin-text-muted)]")}>{item.description}</span>
                    </span>
                    {hot && !active ? <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" /> : null}
                    <span className={cn("relative text-sm transition duration-200", active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-50")}>›</span>
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
