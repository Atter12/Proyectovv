"use client";

import { useMemo, useState } from "react";
import { MissingCobroClaimPanel } from "@/features/clientes/components/MissingCobroClaimPanel.client";
import { ManualPaymentModal } from "@/features/payments/components/ManualPaymentModal.client";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";
import type { ManualPaymentIntentItem } from "@/services/payments.service";

export function PublicLoPagadoActions({
  apiBase,
  claims,
  month,
}: {
  apiBase: string;
  claims: ManualPaymentIntentItem[];
  /** YYYY-MM del link. La boleta faltante solo se reporta de este mes. */
  month: string;
}) {
  const [payOpen, setPayOpen] = useState(false);
  const periodos = useMemo(
    () => (month && /^\d{4}-\d{2}$/.test(month) ? [month] : listRecentPeriodos(1)),
    [month],
  );
  const endpoints = useMemo(
    () => ({
      config: `${apiBase}/config`,
      create: `${apiBase}/manual`,
      proof: (id: string) => `${apiBase}/proof/${id}`,
      claims: `${apiBase}/missing-cobro`,
    }),
    [apiBase],
  );

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#fff8f1] via-white to-[#f7f4ef] p-5 ring-1 ring-[#ffd7b8] sm:p-6">
        <svg
          viewBox="0 0 120 120"
          className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 text-[#ffd7b8] sm:-right-6 sm:-top-6 sm:h-48 sm:w-48"
          fill="currentColor"
          aria-hidden
        >
          <path d="M60 0 66 48 104 16 72 54 120 60 72 66 104 104 66 72 60 120 54 72 16 104 48 66 0 60 48 54 16 16 54 48Z" />
        </svg>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">
              Pagos
            </p>
            <h2 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-[#1a1714] sm:text-[1.5rem]">
              Pago manual
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-[#3f3a34]">
              Paga lo que debes de este mes. Eliges el monto, transfieres y subes
              el voucher. Gerencia lo ve en Pagos manuales como pago de deuda: baja
              lo que debes y no recarga cartera.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#c2410c] px-5 text-[13px] font-semibold text-white transition hover:bg-[#9a3412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d47840] sm:self-auto"
          >
            Pagar y subir voucher
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M5 10h10m-4-4 4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </section>

      <MissingCobroClaimPanel
        periodos={periodos}
        initialClaims={claims}
        endpoints={{
          claims: endpoints.claims,
          proof: endpoints.proof,
        }}
      />

      <ManualPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        paysDebt
        debtMonth={month}
        endpoints={{
          config: endpoints.config,
          create: endpoints.create,
          proof: endpoints.proof,
        }}
      />
    </div>
  );
}
