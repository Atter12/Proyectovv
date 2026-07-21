"use client";

import { Input } from "@/components/ui/Input";

interface PaymentToolbarProps {
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export function PaymentToolbar({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: PaymentToolbarProps) {
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
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 pl-9"
        />
      </div>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-10 rounded-xl border border-[#dbe1ea] bg-white px-3 text-sm text-[#0f172a] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
      >
        <option value="all">Todos los estados</option>
        <option value="active">Activa</option>
        <option value="pending">Pendiente</option>
        <option value="disabled">Desactivada</option>
      </select>
    </div>
  );
}
