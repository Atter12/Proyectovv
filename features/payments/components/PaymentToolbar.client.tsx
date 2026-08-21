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
    <div className="flex flex-col gap-3 border-b border-[var(--auth-border)] bg-[var(--auth-bg)] px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
      <p className="w-full text-[12px] leading-5 text-[var(--auth-text-muted)] sm:hidden">
        Tocá <span className="font-semibold text-[var(--auth-text)]">Asignar saldo</span> en
        la cuenta que quieras recargar.
      </p>
      <div className="relative flex-1 sm:max-w-xs">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--auth-text-soft)]"
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
          placeholder="Buscar cuenta"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 border-[var(--auth-border)] bg-white pl-9 text-[13px]"
        />
      </div>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-9 rounded-lg border border-[var(--auth-border)] bg-white px-3 text-[13px] text-[var(--auth-text)] focus:border-[var(--auth-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/15"
      >
        <option value="all">Todos los estados</option>
        <option value="active">Activa</option>
        <option value="pending">Pendiente</option>
        <option value="disabled">Desactivada</option>
      </select>
    </div>
  );
}
