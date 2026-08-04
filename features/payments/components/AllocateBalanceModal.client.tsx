"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  /** Passed explicitly from parent (context can break across RSC boundaries). */
  agencyBmFunding?: boolean;
}

interface AllocateResponse {
  ok: boolean;
  journalId: string;
}

export function AllocateBalanceModal({
  account,
  open,
  onClose,
  agencyBmFunding = false,
}: AllocateBalanceModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !account || !mounted) return null;

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
          agencyBmFunding,
        }),
      });

      setSuccess(
        agencyBmFunding
          ? `Fondeo BM de ${formatMoney(parsedAmount)} a ${targetAccount.name}.`
          : `Se asignaron ${formatMoney(parsedAmount)} a ${targetAccount.name}.`,
      );
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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/45 backdrop-blur-sm"
        aria-label="Cerrar modal"
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-2xl sm:p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {agencyBmFunding ? "Fondear desde BM" : "Asignar saldo"}
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
          {agencyBmFunding
            ? "Mueve cash del Business Center a esta cuenta ads. No exige saldo en la cartera Holistic (puente contable automático)."
            : "Descuenta la cartera Holistic y mueve cash del BM a esta cuenta ads. Si la cuenta ya tiene saldo en TikTok, puede seguir pautando; esto suma más presupuesto controlado por Holistic."}
        </p>

        <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
          <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
            Cuenta publicitaria
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
            {targetAccount.name}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
            Saldo actual: {formatMoney(targetAccount.balance)}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-[var(--admin-text-muted,#64748b)]">
            TikTok advertiser:{" "}
            {targetAccount.externalAccountId?.trim() || (
              <span className="text-red-600">no configurado</span>
            )}
          </p>
          {targetAccount.externalAccountId?.trim() ===
          "7655333824544374791" ? (
            <p className="mt-2 text-[11px] leading-4 text-amber-800" role="alert">
              Este ID es Branlyn 204 (suele estar suspendida). Cambiá a la 206
              aprobada: 7655330910371594258 en Cuentas ads → Configurar.
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <label
            htmlFor="allocation-amount"
            className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]"
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
            autoFocus
          />
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 text-xs text-emerald-600" role="status">
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
            className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
          >
            {loading
              ? agencyBmFunding
                ? "Fondeando…"
                : "Asignando…"
              : agencyBmFunding
                ? "Fondear desde BM"
                : "Asignar saldo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
