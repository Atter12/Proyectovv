"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PaymentGatewaySelector } from "./PaymentGatewaySelector.client";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

interface PaymentsGatewaySectionProps {
  gateways: PaymentGateway[];
  selected: PaymentGatewayId;
  defaultGateway: PaymentGatewayId;
}

export function PaymentsGatewaySection({
  gateways,
  selected,
  defaultGateway,
}: PaymentsGatewaySectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(id: PaymentGatewayId) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === defaultGateway) params.delete("gateway");
    else params.set("gateway", id);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-[#0f172a]">
        Método de pago
      </h2>
      <PaymentGatewaySelector
        gateways={gateways}
        selected={selected}
        onSelect={handleSelect}
      />
    </div>
  );
}
