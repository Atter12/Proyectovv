"use client";

import { cn } from "@/lib/cn";
import { GatewayLogo } from "./GatewayLogo";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

interface PaymentGatewaySelectorProps {
  gateways: PaymentGateway[];
  selected: PaymentGatewayId;
  onSelect: (id: PaymentGatewayId) => void;
}

export function PaymentGatewaySelector({
  gateways,
  selected,
  onSelect,
}: PaymentGatewaySelectorProps) {
  return (
    <div className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-5">
      {gateways.map((gateway) => {
        const isSelected = selected === gateway.id;
        return (
          <button
            key={gateway.id}
            type="button"
            onClick={() => onSelect(gateway.id)}
            aria-pressed={isSelected}
            className={cn(
              "min-w-[148px] shrink-0 rounded-2xl border p-4 text-left transition-all duration-200 sm:min-w-0",
              isSelected
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-md shadow-[var(--brand-primary)]/10 ring-2 ring-[var(--brand-primary)]/20"
                : "border-[var(--border-subtle)] bg-white hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <GatewayLogo gatewayId={gateway.id} />
              {isSelected ? (
                <span className="rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-primary)]">
                  Seleccionado
                </span>
              ) : (
                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--admin-text-muted,#64748b)]">
                  Elegir
                </span>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
              {gateway.name}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--admin-text-muted,#64748b)]">
              {gateway.description}
            </p>
            <p
              className={cn(
                "mt-3 text-[12px] font-semibold",
                isSelected
                  ? "text-[var(--brand-primary)]"
                  : "text-[var(--admin-text-muted,#64748b)]",
              )}
            >
              {isSelected ? "Abrir depósito →" : "Toca para pagar →"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
