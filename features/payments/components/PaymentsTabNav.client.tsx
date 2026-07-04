"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { PaymentTabKey } from "@/types/payment";

const TAB_ITEMS: {
  id: PaymentTabKey;
  label: string;
  shortLabel: string;
}[] = [
  { id: "assignment", label: "Asignación de saldo", shortLabel: "Asignación" },
  {
    id: "account-tx",
    label: "Historial de transacciones de la cuenta publicitaria",
    shortLabel: "Hist. cuenta",
  },
  {
    id: "wallet-tx",
    label: "Historial de transacciones de la Cartera Default",
    shortLabel: "Hist. cartera",
  },
  { id: "refunds", label: "Historial de reembolsos", shortLabel: "Reembolsos" },
];

interface PaymentsTabNavProps {
  activeTab: PaymentTabKey;
}

export function PaymentsTabNav({ activeTab }: PaymentsTabNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleTabChange(tab: PaymentTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "assignment") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="scrollbar-thin overflow-x-auto border-b border-[#e5e7eb]">
      <div className="flex min-w-max gap-1 px-2 pt-2 sm:px-4">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-t-xl px-3 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40 sm:px-4",
              activeTab === tab.id
                ? "bg-white text-[#4056ff] shadow-sm ring-1 ring-[#e5e7eb] ring-b-white"
                : "text-[#64748b] hover:bg-slate-50 hover:text-[#0f172a]",
            )}
          >
            <span className="md:hidden">{tab.shortLabel}</span>
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
