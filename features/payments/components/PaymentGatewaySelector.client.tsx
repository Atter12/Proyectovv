"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

interface PaymentGatewaySelectorProps {
  gateways: PaymentGateway[];
}

export function PaymentGatewaySelector({ gateways }: PaymentGatewaySelectorProps) {
  const [selected, setSelected] = useState<PaymentGatewayId>(gateways[0]?.id ?? "stripe");

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {gateways.map((gateway) => (
        <button
          key={gateway.id}
          type="button"
          onClick={() => setSelected(gateway.id)}
          className={cn(
            "rounded-xl border p-4 text-left transition-all",
            selected === gateway.id
              ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <p className="text-sm font-semibold text-slate-900">{gateway.name}</p>
          <p className="mt-1 text-xs text-slate-500">{gateway.description}</p>
        </button>
      ))}
    </div>
  );
}
