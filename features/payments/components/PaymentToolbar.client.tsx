"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/Input";

interface PaymentToolbarProps {
  initialSearch?: string;
  initialStatus?: string;
}

export function PaymentToolbar({
  initialSearch = "",
  initialStatus = "all",
}: PaymentToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 border-b border-[#e5e7eb] p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="relative flex-1 sm:max-w-sm">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <Input
          placeholder="Buscar cuenta publicitaria"
          value={search}
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            updateParams({ q: value || null });
          }}
          className="h-10 pl-9"
        />
      </div>
      <select
        value={status}
        onChange={(e) => {
          const value = e.target.value;
          setStatus(value);
          updateParams({ status: value === "all" ? null : value });
        }}
        className="h-10 rounded-xl border border-[#dbe1ea] bg-white px-3 text-sm text-[#0f172a] focus:border-[#4056ff] focus:outline-none focus:ring-2 focus:ring-[#4056ff]/20"
      >
        <option value="all">Todos los estados</option>
        <option value="active">Activa</option>
        <option value="pending">Pendiente</option>
        <option value="disabled">Desactivada</option>
      </select>
    </div>
  );
}
