"use client";

import { Card } from "@/components/ui/Card";
import { PaymentGatewaySelector } from "./PaymentGatewaySelector.client";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

interface PaymentsGatewaySectionProps {
  gateways: PaymentGateway[];
  selected: PaymentGatewayId;
  onSelect: (id: PaymentGatewayId) => void;
  onContinue: () => void;
}

export function PaymentsGatewaySection({
  gateways,
  selected,
  onSelect,
  onContinue,
}: PaymentsGatewaySectionProps) {
  const selectedGateway = gateways.find((g) => g.id === selected);

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
          Pagar / agregar saldo
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-[var(--admin-text-muted,#64748b)]">
          Elige la pasarela (Stripe, Culqi, etc.). Al seleccionarla se abre el
          depósito al instante.
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <PaymentGatewaySelector
          gateways={gateways}
          selected={selected}
          onSelect={onSelect}
        />

        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--brand-primary)]">
              Siguiente paso
            </p>
            <p className="mt-1 text-[14px] text-[var(--foreground)]">
              {selectedGateway
                ? `Continúa el depósito con ${selectedGateway.name}.`
                : "Selecciona un método de pago para continuar."}
            </p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.32)] transition-colors hover:bg-[var(--brand-primary-deep)] sm:h-11 sm:w-auto"
          >
            {selectedGateway
              ? `Pagar con ${selectedGateway.name}`
              : "Agregar saldo"}
          </button>
        </div>
      </div>
    </Card>
  );
}
