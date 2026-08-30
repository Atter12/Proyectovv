"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format-money";
import { mapAdAccountStatusLabel } from "@/lib/ui/labels";
import type { PaymentAccountAllocation } from "@/types/payment";
import { ReclaimBalanceModal } from "./ReclaimBalanceModal.client";

export function PaymentsReclaimSection({
  accounts,
  allowForceLedger = false,
}: {
  accounts: PaymentAccountAllocation[];
  allowForceLedger?: boolean;
}) {
  const [selected, setSelected] = useState<PaymentAccountAllocation | null>(
    null,
  );

  if (accounts.length === 0) return null;

  return (
    <section className="dashboard-surface-card overflow-hidden rounded-[1rem] border border-amber-200/80">
      <div className="border-b border-amber-100 bg-amber-50/60 px-5 py-4 sm:px-6">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-amber-900">
          Recuperar saldo
        </p>
        <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
          Cuentas con plata trabada
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
          Si una cuenta se suspendió y todavía tiene saldo asignado, jalalo de
          vuelta a la cartera Holistic (BM 200 = cash TikTok → BM; luego
          cartera).
        </p>
      </div>

      <ul className="divide-y divide-[rgb(20_18_16_/_0.06)]">
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#1a1612]">
                {account.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#7a736a]">
                {account.bmLabel ? (
                  <span className="rounded-md bg-[#eef4ff] px-1.5 py-0.5 font-semibold text-[#1e40af] ring-1 ring-[#c7d7fe]">
                    {account.bmLabel}
                  </span>
                ) : null}
                <span className="rounded-md bg-[#fef2f2] px-1.5 py-0.5 font-semibold text-[#991b1b]">
                  {mapAdAccountStatusLabel(account.status)}
                </span>
                <span className="font-semibold tabular-nums text-[#1a1612]">
                  {formatMoney(account.balance)}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              className="h-10 shrink-0 rounded-xl bg-[var(--auth-accent)] px-4 text-[13px] font-bold text-white"
              onClick={() => setSelected(account)}
            >
              Recuperar a cartera
            </Button>
          </li>
        ))}
      </ul>

      <ReclaimBalanceModal
        account={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        allowForceLedger={allowForceLedger}
      />
    </section>
  );
}
