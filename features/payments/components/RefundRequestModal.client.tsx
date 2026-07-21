"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { formatMoney } from "@/lib/format-money";

interface RefundRequestModalProps {
  open: boolean;
  onClose: () => void;
  availableBalance: number;
  currency: string;
}

interface RefundResponse {
  ok: boolean;
  refundRequest: {
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
  };
}

export function RefundRequestModal({
  open,
  onClose,
  availableBalance,
  currency,
}: RefundRequestModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
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

  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= availableBalance;

  function resetAndClose() {
    setAmount("");
    setReason("");
    setError(null);
    setSuccess(null);
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    if (!isValidAmount) {
      setError(`Ingresa un monto válido hasta ${formatMoney(availableBalance, currency)}.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient<RefundResponse>("/api/payments/refunds", {
        method: "POST",
        body: JSON.stringify({ amount: parsedAmount, currency, reason }),
      });
      setSuccess(`Solicitud ${data.refundRequest.id.slice(0, 8)} creada y pendiente de revisión.`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo solicitar el reembolso.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/40 backdrop-blur-sm"
        aria-label="Cerrar modal"
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-request-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xl sm:p-6"
      >
        {success ? (
          <>
            <h2 id="refund-request-title" className="text-lg font-semibold text-[#0f172a]">
              Reembolso solicitado
            </h2>
            <p className="mt-3 text-sm text-[#64748b]">{success}</p>
            <div className="mt-6 flex justify-end">
              <Button onClick={resetAndClose}>Cerrar</Button>
            </div>
          </>
        ) : (
          <>
            <h2 id="refund-request-title" className="text-lg font-semibold text-[#0f172a]">
              Solicitar reembolso
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              La solicitud quedará pendiente para aprobación en el panel admin.
            </p>
            <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-slate-50 px-4 py-3">
              <p className="text-xs text-[#64748b]">Saldo disponible</p>
              <p className="text-lg font-bold text-[#0f172a]">
                {formatMoney(availableBalance, currency)}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Monto a reembolsar
                </label>
                <Input
                  type="number"
                  min="1"
                  max={availableBalance}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50.00"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Motivo opcional
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={240}
                  className="w-full rounded-2xl border border-[var(--border-subtle)] bg-white/90 px-3.5 py-2.5 text-sm text-slate-950 shadow-sm shadow-slate-950/[0.03] transition-all placeholder:text-slate-400 focus:border-[var(--brand-primary)]/55 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--brand-primary)]/10"
                  placeholder="Ej. Reasignación de presupuesto"
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={resetAndClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Solicitando…" : "Solicitar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
