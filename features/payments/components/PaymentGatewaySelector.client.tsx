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
              "relative flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
              isSelected
                ? "border-[#c45a18]/45 bg-[#fff8f3]"
                : "border-[rgb(20_18_16_/_0.08)] bg-white hover:border-[rgb(20_18_16_/_0.14)] hover:bg-[#faf7f3]",
            )}
          >
            {isSelected ? (
              <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#c45a18]"
              />
            ) : null}

            <GatewayLogo gatewayId={gateway.id} size="sm" />

            <div className="min-w-0 flex-1 pl-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-medium text-[#1a1612]">
                  {gateway.name}
                </p>
                {isSelected ? (
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.06em] text-[#c45a18]">
                    Activo
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#7a736a]">
                {gateway.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
