"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { formatMoney } from "@/lib/format-money";
import type { PaymentAccountAllocation } from "@/types/payment";

interface ReclaimBalanceModalProps {
  account: PaymentAccountAllocation | null;
  open: boolean;
  onClose: () => void;
  /** Staff: permite forzar solo ledger si TikTok falla. */
  allowForceLedger?: boolean;
  /** Refresca saldo TikTok en vivo (sin F5). */
  onFundingChanged?: () => void | Promise<void>;
}

interface ReclaimResponse {
  ok: boolean;
  amountUsd: number;
  path: string;
}

export function ReclaimBalanceModal({
  account,
  open,
  onClose,
  allowForceLedger = false,
  onFundingChanged,
}: ReclaimBalanceModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [forceLedgerOnly, setForceLedgerOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !account) return;
    setAmount(account.balance > 0 ? String(account.balance) : "");
    setForceLedgerOnly(false);
    setError(null);
    setSuccess(null);
  }, [open, account]);

  if (!open || !account || !mounted) return null;

  const maxAmount = account.balance;
  const parsed = Number.parseFloat(amount);
  const isValid =
    Number.isFinite(parsed) && parsed > 0 && parsed <= maxAmount + 1e-9;

  function resetAndClose() {
    setAmount("");
    setError(null);
    setSuccess(null);
    setLoading(false);
    setForceLedgerOnly(false);
    onClose();
  }

  async function handleSubmit() {
    if (!isValid) {
      setError(
        maxAmount <= 0
          ? "No hay saldo recuperable en esta cuenta."
          : `Ingresá un monto entre 0.01 y ${formatMoney(maxAmount)}.`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient<ReclaimResponse>("/api/payments/reclaim", {
        method: "POST",
        body: JSON.stringify({
          adAccountId: account!.id,
          amount: parsed,
          forceLedgerOnly: allowForceLedger ? forceLedgerOnly : false,
        }),
      });
      setSuccess(
        `Se recuperaron ${formatMoney(res.amountUsd)} a la cartera Holistic (${res.path}).`,
      );
      router.refresh();
      await onFundingChanged?.();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo recuperar el saldo.",
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
          Recuperar saldo a cartera
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
          Jala el cash/presupuesto de esta cuenta ads de vuelta a saldo
          disponible Holistic (útil si la cuenta se suspendió).
        </p>

        <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
          <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
            Cuenta
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
            {account.name}
          </p>
          {account.bmLabel ? (
            <span className="mt-1.5 inline-flex rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af] ring-1 ring-[#c7d7fe]">
              {account.bmLabel}
            </span>
          ) : null}
          <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
            Saldo Holistic en cuenta: {formatMoney(account.balance)}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Estado: {account.status === "disabled" ? "Suspendida" : account.status}
          </p>
        </div>

        <div className="mt-5">
          <label
            htmlFor="reclaim-amount"
            className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]"
          >
            Monto a recuperar (USD)
          </label>
          <Input
            id="reclaim-amount"
            type="number"
            min={0.01}
            max={maxAmount}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <p className="mt-1.5 text-[12px] text-[#6b645c]">
            Máximo: {formatMoney(maxAmount)}. En BM 200 TikTok solo deja jalar el
            cash que quede sin gastar.
          </p>
        </div>

        {allowForceLedger ? (
          <label className="mt-4 flex items-start gap-2 text-[12px] leading-5 text-[#6b645c]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={forceLedgerOnly}
              onChange={(e) => setForceLedgerOnly(e.target.checked)}
            />
            <span>
              Solo ledger (staff): si TikTok falla, igual devolver a cartera
              Holistic. Usar con cuidado.
            </span>
          </label>
        ) : null}

        {error ? (
          <p
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-950"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 text-xs text-emerald-600" role="status">
            {success}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            Cerrar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !isValid}
            className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
          >
            {loading ? "Recuperando…" : "Recuperar a cartera"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
