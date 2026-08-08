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
    <div
      role="radiogroup"
      aria-label="Método de pago"
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
    >
      {gateways.map((gateway) => {
        const isSelected = selected === gateway.id;
        return (
          <button
            key={gateway.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(gateway.id)}
            className={cn(
              "relative flex items-start gap-3 rounded-[0.85rem] border px-3.5 py-3 text-left transition-colors",
              isSelected
                ? "border-[var(--auth-accent)] bg-[var(--auth-accent-soft)]"
                : "border-[var(--auth-border)] bg-white hover:border-[var(--auth-accent)]/40 hover:bg-[var(--auth-bg)]",
            )}
          >
            {isSelected ? (
              <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--auth-accent)]"
              />
            ) : null}

            <GatewayLogo gatewayId={gateway.id} size="sm" />

            <div className="min-w-0 flex-1 pl-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                  {gateway.name}
                </p>
                {isSelected ? (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-accent)]">
                    Activo
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[var(--auth-text-muted)]">
                {gateway.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
