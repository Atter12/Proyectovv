"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { formatMoney } from "@/lib/format-money";
import type { PaymentAccountAllocation } from "@/types/payment";

interface AllocateBalanceModalProps {
  account: PaymentAccountAllocation | null;
  open: boolean;
  onClose: () => void;
}

interface AllocateResponse {
  ok: boolean;
  journalId: string;
}

export function AllocateBalanceModal({
  account,
  open,
  onClose,
}: AllocateBalanceModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open || !account) return null;

  const targetAccount = account;
  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  function resetAndClose() {
    setAmount("");
    setError(null);
    setSuccess(null);
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    if (!isValidAmount) {
      setError("Ingresa un monto válido mayor a cero.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient<AllocateResponse>("/api/payments/allocations", {
        method: "POST",
        body: JSON.stringify({
          adAccountId: targetAccount.id,
          amount: parsedAmount,
          currency: "USD",
        }),
      });

      setSuccess(`Se asignaron ${formatMoney(parsedAmount)} a ${targetAccount.name}.`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo asignar el saldo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/40 backdrop-blur-sm"
        aria-label="Cerrar modal"
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xl sm:p-6"
      >
        <h2 className="text-lg font-semibold text-[#0f172a]">
          Asignar saldo
        </h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Mueve saldo disponible de la cartera hacia una cuenta publicitaria usando el ledger financiero.
        </p>

        <div className="mt-5 rounded-xl border border-[#e5e7eb] bg-slate-50 px-4 py-3">
          <p className="text-xs text-[#64748b]">Cuenta publicitaria</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0f172a]">
            {targetAccount.name}
          </p>
          <p className="mt-1 text-xs text-[#64748b]">
            Saldo actual: {formatMoney(targetAccount.balance)}
          </p>
        </div>

        <div className="mt-5">
          <label
            htmlFor="allocation-amount"
            className="mb-1.5 block text-xs font-medium text-[#64748b]"
          >
            Monto a asignar (USD)
          </label>
          <Input
            id="allocation-amount"
            type="number"
            min={1}
            step="0.01"
            placeholder="100.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 text-xs text-[#16a34a]" role="status">
            {success}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            Cerrar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !isValidAmount}
            className="bg-[#4056ff] hover:bg-[#4056ff]/90"
          >
            {loading ? "Asignando…" : "Asignar saldo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
