"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigation } from "@/config/navigation";
import { cn } from "@/lib/cn";

export function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1.5">
      {adminNavigation.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-3 transition",
              active
                ? "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                : "text-slate-600 hover:bg-white hover:text-slate-950",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-black",
                active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600",
              )}
            >
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">{item.label}</span>
              <span className={cn("block truncate text-xs", active ? "text-white/60" : "text-slate-400")}>{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
