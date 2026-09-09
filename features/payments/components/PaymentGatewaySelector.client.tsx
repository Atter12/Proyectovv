"use client";

import { cn } from "@/lib/cn";
import { GatewayLogo } from "./GatewayLogo";
import { PaymentAppIcon } from "./PaymentAppIcon";
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
      className="grid gap-2 lg:grid-cols-[1fr_1.2fr_1fr]"
    >
      {gateways.map((gateway) => {
        const inMaintenance = Boolean(gateway.maintenance);
        const isSelected = selected === gateway.id && !inMaintenance;
        return (
          <button
            key={gateway.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={inMaintenance}
            disabled={inMaintenance}
            onClick={() => {
              if (inMaintenance) return;
              onSelect(gateway.id);
            }}
            className={cn(
              "relative flex min-h-20 items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/30 focus-visible:ring-offset-2 active:scale-[0.99]",
              inMaintenance
                ? "cursor-not-allowed border-[var(--auth-border)] bg-[#f7f5f2] opacity-80"
                : isSelected
                  ? "border-[var(--auth-accent)] bg-[var(--auth-accent-soft)]"
                  : "border-[var(--auth-border)] bg-white hover:border-[var(--auth-accent)]/40 hover:bg-[var(--auth-bg)]",
            )}
          >
            <GatewayLogo gatewayId={gateway.id} size="sm" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold text-[var(--auth-text)]">
                  {gateway.name}
                </p>
                {inMaintenance ? (
                  <span className="shrink-0 rounded-full bg-[#e7e2db] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#5c564e]">
                    Mantenimiento
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[var(--auth-text-muted)]">
                {gateway.description}
              </p>
              {gateway.id === "stripe" ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {(["visa", "mastercard"] as const).map((app) => (
                    <PaymentAppIcon key={app} app={app} size="sm" />
                  ))}
                </div>
              ) : gateway.id === "cobrana" ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {(["yape", "plin"] as const).map((app) => (
                    <PaymentAppIcon key={app} app={app} size="sm" />
                  ))}
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
