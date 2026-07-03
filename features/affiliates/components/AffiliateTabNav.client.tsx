"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { AffiliateTabKey } from "@/types/affiliate";

const TAB_ITEMS: { id: AffiliateTabKey; label: string }[] = [
  { id: "earn", label: "Gana dinero" },
  { id: "payments", label: "Pagos" },
];

interface AffiliateTabNavProps {
  activeTab: AffiliateTabKey;
}

export function AffiliateTabNav({ activeTab }: AffiliateTabNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectTab(tab: AffiliateTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "earn") params.delete("tab");
    else params.set("tab", tab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="scrollbar-thin overflow-x-auto border-b border-[#e5e7eb]">
      <div className="flex min-w-max gap-1 px-1">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={cn(
              "shrink-0 rounded-t-xl px-5 py-3 text-sm font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-white text-[#4056ff] shadow-sm ring-1 ring-[#e5e7eb] ring-b-white"
                : "text-[#64748b] hover:bg-slate-50 hover:text-[#0f172a]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
