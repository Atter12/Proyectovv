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
            <div className="mb-2 flex items-end justify-between px-3">
              <div>
                <p className="text-[0.63rem] font-black uppercase tracking-[0.24em] text-[#8ee9ff]">{group.title}</p>
                <p className="mt-0.5 text-[0.64rem] font-bold text-[#77a8b8]">{group.eyebrow}</p>
              </div>
              <span className="h-px flex-1 translate-y-[-7px] bg-gradient-to-r from-[#8ee9ff]/30 to-transparent ml-3" />
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
                      "admin-nav-item group relative flex items-center gap-3 overflow-hidden rounded-[1.25rem] px-3 py-2.5 outline-none transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[#9af7c9]/80",
                      active
                        ? "is-active bg-[#9af7c9] text-[#061925] shadow-[0_16px_38px_rgba(154,247,201,0.25)]"
                        : "text-[#c9e2eb] hover:-translate-y-0.5 hover:bg-white/[0.075] hover:text-white hover:shadow-[0_14px_26px_rgba(0,0,0,0.14)]",
                    )}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.28),transparent_32%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    {active ? <span className="absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full bg-[#063048]" /> : null}
                    <span
                      className={cn(
                        "relative grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-sm font-black transition-all duration-200",
                        active
                          ? "bg-[#063048]/10 text-[#063048] shadow-inner"
                          : "bg-[#123d51] text-[#8ee9ff] ring-1 ring-white/[0.06] group-hover:scale-105 group-hover:bg-[#164f67] group-hover:text-[#9af7c9]",
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-[0.92rem] font-black leading-5 tracking-[-0.01em]">{item.label}</span>
                      <span className={cn("block truncate text-xs font-semibold", active ? "text-[#16506a]" : "text-[#7baabd] group-hover:text-[#a8d8e6]")}>{item.description}</span>
                    </span>
                    {hot && !active ? <span className="relative h-2 w-2 rounded-full bg-[#9af7c9] shadow-[0_0_0_4px_rgba(154,247,201,0.10)]" /> : null}
                    <span className={cn("relative text-sm transition", active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-70")}>›</span>
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
