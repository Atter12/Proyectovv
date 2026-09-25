"use client";

import { useMemo, useState } from "react";
import { MissingCobroClaimPanel } from "@/features/clientes/components/MissingCobroClaimPanel.client";
import { ManualPaymentModal } from "@/features/payments/components/ManualPaymentModal.client";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";
import type { ManualPaymentIntentItem } from "@/services/payments.service";

type Activity = {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  reviewStatus: string;
  kind: "manual" | "missing_cobro";
  periodoResumen: string | null;
};

function money(amount: number, currency: string): string {
  const code = currency.toUpperCase() === "PEN" ? "PEN" : "USD";
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending_review":
      return "En revisión";
    case "approved":
      return "Aprobado";
    case "rejected":
      return "Rechazado";
    default:
      return "Falta voucher";
  }
}

export function PublicLoPagadoActions({
  apiBase,
  feePercent,
  claims,
  activity,
}: {
  apiBase: string;
  feePercent: number;
  claims: ManualPaymentIntentItem[];
  activity: Activity[];
}) {
  const [payOpen, setPayOpen] = useState(false);
  const periodos = useMemo(() => listRecentPeriodos(6), []);
  const manuals = activity.filter((row) => row.kind === "manual").slice(0, 6);
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
      <section className="relative overflow-hidden rounded-2xl border border-[#ffd7b8] bg-gradient-to-br from-[#fff8f1] via-white to-[#f7f4ef] p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">
          Pagos
        </p>
        <h2 className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em] text-[#1a1714]">
          Pago manual
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#5c564e]">
          Es el mismo pago de Ads Holistic: eliges el monto, ves las cuentas y
          subes el voucher. Queda en esta cuenta para que gerencia lo revise.
        </p>
        <button
          type="button"
          onClick={() => setPayOpen(true)}
          className="mt-4 inline-flex h-10 items-center rounded-[10px] bg-[#c2410c] px-4 text-[13px] font-semibold text-white hover:bg-[#9a3412]"
        >
          Pagar y subir voucher
        </button>
        {manuals.length > 0 ? (
          <ul className="mt-4 divide-y divide-[#f0e6dc] rounded-xl border border-[#f0e6dc] bg-white">
            {manuals.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-[12px]"
              >
                <span className="font-semibold tabular-nums text-[#1a1714]">
                  {money(row.amount, row.currency)}
                </span>
                <span className="text-[#78716c]">{statusLabel(row.reviewStatus)}</span>
              </li>
            ))}
          </ul>
        ) : null}
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
        feePercent={feePercent}
        endpoints={{
          config: endpoints.config,
          create: endpoints.create,
          proof: endpoints.proof,
        }}
      />
    </div>
  );
}
