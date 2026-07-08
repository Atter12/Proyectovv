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

export function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="space-y-5">
      {groups.map((group) => {
        const items = adminNavigation.filter((item) => group.items.includes(item.href));
        return (
          <section key={group.title}>
            <p className="mb-2 px-3 text-[0.63rem] font-black uppercase tracking-[0.22em] text-[#8fc7d8]">{group.title}</p>
            <div className="space-y-1">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition",
                      active
                        ? "bg-[#9af7c9] text-[#062235] shadow-lg shadow-[#9af7c9]/20"
                        : "text-[#c7dce5] hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-black transition",
                        active ? "bg-[#063048]/10 text-[#063048]" : "bg-white/7 text-[#8fc7d8] group-hover:bg-white/12 group-hover:text-[#9af7c9]",
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{item.label}</span>
                      <span className={cn("block truncate text-xs", active ? "text-[#16445a]" : "text-[#789bad]")}>{item.description}</span>
                    </span>
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
