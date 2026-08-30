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
  clienteName,
}: {
  accounts: PaymentAccountAllocation[];
  allowForceLedger?: boolean;
  clienteName?: string;
}) {
  const [selected, setSelected] = useState<PaymentAccountAllocation | null>(
    null,
  );

  if (accounts.length === 0) return null;

  const recoverable = accounts.filter((a) => Number(a.balance) > 0);
  const totalRecoverable = recoverable.reduce(
    (sum, a) => sum + Number(a.balance || 0),
    0,
  );

  return (
    <section
      id="recuperar-saldo"
      className="overflow-hidden rounded-[1.25rem] border border-[#f0c4a8] bg-[linear-gradient(180deg,#fff8f2_0%,#ffffff_42%)] shadow-[0_12px_28px_rgb(20_18_16_/_0.04)]"
    >
      <div className="border-b border-[#f0d9c4] px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#c45a18]">
              Recuperar · no pierdas plata
            </p>
            <h2 className="mt-1.5 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1a1612]">
              Cuentas suspendidas
              {clienteName ? ` · ${clienteName}` : ""}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[#6b645c]">
              Estas cuentas estánieron de la lista de Recargar porque TikTok las
              suspendió. Si todavía hay saldo asignado en Holistic, jalalo a{" "}
              <span className="font-semibold text-[#1a1612]">
                saldo disponible
              </span>{" "}
              y usalo en otra cuenta Aprobada.
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-[#f0d9c4]">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a9187]">
              Recuperable ahora
            </p>
            <p className="mt-0.5 text-[1.15rem] font-bold tabular-nums tracking-[-0.02em] text-[#c45a18]">
              {formatMoney(totalRecoverable)}
            </p>
            <p className="text-[11px] text-[#7a736a]">
              {recoverable.length} con saldo · {accounts.length} suspendida
              {accounts.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-[#f0e6dc]">
        {accounts.map((account) => {
          const canReclaim = Number(account.balance) > 0;
          return (
            <li
              key={account.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                  {account.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {account.bmLabel ? (
                    <span className="rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af] ring-1 ring-[#c7d7fe]">
                      {account.bmLabel}
                    </span>
                  ) : null}
                  <span className="rounded-md bg-[#fef2f2] px-1.5 py-0.5 text-[10px] font-semibold text-[#991b1b] ring-1 ring-[#fecaca]">
                    {mapAdAccountStatusLabel(account.status)}
                  </span>
                  <span className="rounded-md bg-[#f3eee8] px-1.5 py-0.5 font-mono text-[10px] text-[#7a736a]">
                    adv {account.externalAccountId?.trim() || "—"}
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-semibold tabular-nums text-[#1a1612]">
                  Saldo en cuenta: {formatMoney(account.balance)}
                </p>
                {!canReclaim ? (
                  <p className="mt-1 text-[12px] leading-4 text-[#7a736a]">
                    En Holistic ya está en $0 (se gastó o nunca se asignó acá).
                    No hay nada que devolver a cartera desde esta fila.
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] leading-4 text-[#6b645c]">
                    Ese monto vuelve a tu saldo disponible al tocar Recuperar.
                  </p>
                )}
              </div>

              <Button
                size="sm"
                disabled={!canReclaim}
                className="h-11 shrink-0 rounded-xl bg-[#c45a18] px-4 text-[13px] font-bold text-white hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setSelected(account)}
              >
                {canReclaim ? "Recuperar a saldo disponible" : "Sin saldo"}
              </Button>
            </li>
          );
        })}
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
