"use client";

import { useMemo } from "react";
import { isSystemAllocatableBmLabel } from "@/lib/hecom/bm-bucket.shared";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsBm200AllocateBannerProps {
  accounts: PaymentAccountAllocation[];
}

export function PaymentsBm200AllocateBanner({
  accounts,
}: PaymentsBm200AllocateBannerProps) {
  const { bm200Accounts, otherAccounts } = useMemo(() => {
    const bm200: PaymentAccountAllocation[] = [];
    const other: PaymentAccountAllocation[] = [];
    for (const account of accounts) {
      if (isSystemAllocatableBmLabel(account.bmLabel)) {
        bm200.push(account);
      } else {
        other.push(account);
      }
    }
    bm200.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { bm200Accounts: bm200, otherAccounts: other };
  }, [accounts]);

  if (accounts.length === 0) return null;

  return (
    <div
      className="mx-4 mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-4 sm:mx-5 sm:px-5"
      role="note"
    >
      <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-amber-950">
        Importante — recarga desde Holistic
      </p>
      <p className="mt-2 text-[13px] leading-5 text-amber-950">
        Solo podés{" "}
        <span className="font-semibold">asignar saldo desde esta plataforma</span>{" "}
        a cuentas del{" "}
        <span className="font-semibold">BM 200</span> (TikTok tiene efectivo
        disponible). Las cuentas BM 10 y BM 30 usan crédito compartido:{" "}
        <span className="font-semibold">contactá a soporte Holistic</span> para
        recargarlas — no uses Asignar ahí.
      </p>

      {bm200Accounts.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-300/80 bg-white/70 px-3 py-2.5">
          <p className="text-[12px] font-semibold text-emerald-900">
            Cuentas habilitadas para Asignar (BM 200)
          </p>
          <ul className="mt-1.5 max-h-36 space-y-1 overflow-y-auto text-[12px] leading-5 text-[#1a1612]">
            {bm200Accounts.map((account) => (
              <li key={account.id} className="flex gap-2">
                <span className="text-emerald-700" aria-hidden>
                  ✓
                </span>
                <span className="min-w-0 truncate">{account.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-amber-300/80 bg-white/70 px-3 py-2.5 text-[12px] leading-5 text-amber-950">
          No tenés cuentas BM 200 en la lista. Para recargar desde Holistic
          necesitás una cuenta vinculada a BM 200, o pedile a soporte que te
          ayude con BM 10 / BM 30.
        </p>
      )}

      {otherAccounts.length > 0 ? (
        <p className="mt-3 text-[12px] leading-5 text-amber-900/90">
          {otherAccounts.length} cuenta
          {otherAccounts.length === 1 ? "" : "s"} BM 10 / BM 30 / otras: solo
          por soporte (el botón Asignar aparece deshabilitado).
        </p>
      ) : null}
    </div>
  );
}
