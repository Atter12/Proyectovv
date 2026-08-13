"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import {
  formatFeePercentLabel,
  splitDepositByFeePercent,
} from "@/lib/payments/deposit-fee";
import type { PaymentGatewayId } from "@/types/payment";
import { isVoucherPaymentProvider } from "@/types/payment";

interface AddBalanceModalProps {
  open: boolean;
  onClose: () => void;
  selectedGateway?: PaymentGatewayId;
  /** Fee % Hecom (tiktok_default_fee / cuenta). */
  feePercent?: number;
}

interface CreateIntentResponse {
  ok: boolean;
  paymentIntent: {
    paymentIntentId: string;
    status: string;
    checkoutUrl: string | null;
    providerConfigured: boolean;
    message?: string;
    feePercent?: number;
    feeCents?: number;
    creditCents?: number;
    grossCents?: number;
  };
}

interface ProofUploadResponse {
  ok: boolean;
  paymentIntent: {
    id: string;
    status: string;
    manualReviewStatus: string;
    proofFileName: string;
    submittedAt: string;
  };
}

const gatewayLabels: Record<PaymentGatewayId, string> = {
  stripe: "Stripe",
  culqi: "Culqi",
  mercadopago: "Mercado Pago",
  crypto: "Cripto (USDT)",
  manual: "Pago manual",
};

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100_000;

export function AddBalanceModal({
  open,
  onClose,
  selectedGateway = "stripe",
  feePercent = 10,
}: AddBalanceModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "proof" | "result">("form");
  const [loading, setLoading] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_AMOUNT &&
    parsedAmount <= MAX_AMOUNT;
  const isVoucher = isVoucherPaymentProvider(selectedGateway);

  const feePreview = useMemo(() => {
    if (!isValidAmount) return null;
    return splitDepositByFeePercent(Math.round(parsedAmount * 100), feePercent);
  }, [feePercent, isValidAmount, parsedAmount]);

  function handleClose() {
    setStep("form");
    setAmount("");
    setError(null);
    setResultMessage(null);
    setPaymentIntentId(null);
    setProofFile(null);
    setLoading(false);
    setUploadingProof(false);
    onClose();
  }

  function handleContinueToConfirm() {
    if (!isValidAmount) {
      setError(
        `Ingresa un monto entre ${formatMoney(MIN_AMOUNT)} y ${formatMoney(MAX_AMOUNT)}.`,
      );
      return;
    }
    setError(null);
    setStep("confirm");
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient<CreateIntentResponse>("/api/payments/intents", {
        method: "POST",
        body: JSON.stringify({
          amount: parsedAmount,
          currency: "USD",
          provider: selectedGateway,
        }),
      });

      if (data.paymentIntent.checkoutUrl) {
        window.location.assign(data.paymentIntent.checkoutUrl);
        return;
      }

      setPaymentIntentId(data.paymentIntent.paymentIntentId);
      const creditLabel =
        data.paymentIntent.creditCents != null
          ? formatMoney(data.paymentIntent.creditCents / 100)
          : feePreview
            ? formatMoney(feePreview.creditCents / 100)
            : formatMoney(parsedAmount);
      const defaultMessage = data.paymentIntent.providerConfigured
        ? `Intención creada. Pagás ${formatMoney(parsedAmount)}; a la cartera llegan ${creditLabel} (fee ${formatFeePercentLabel(feePercent)}).`
        : "La pasarela aún no está configurada. Se registró una intención pendiente.";

      setResultMessage(data.paymentIntent.message ?? defaultMessage);
      setStep(isVoucher ? "proof" : "result");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo crear la intención de pago.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleProofUpload() {
    if (!paymentIntentId) {
      setError("Primero crea la intención de pago manual.");
      return;
    }
    if (!proofFile) {
      setError("Selecciona el voucher o comprobante de transferencia.");
      return;
    }

    setUploadingProof(true);
    setError(null);

    const formData = new FormData();
    formData.append("proof", proofFile);

    try {
      const data = await apiClient<ProofUploadResponse>(
        `/api/payments/intents/${paymentIntentId}/proof`,
        {
          method: "POST",
          body: formData,
        },
      );
      setResultMessage(
        `Voucher ${data.paymentIntent.proofFileName} enviado. Tu pago quedó en revisión manual.`,
      );
      setStep("result");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo subir el comprobante.",
      );
    } finally {
      setUploadingProof(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/45 backdrop-blur-sm"
        aria-label="Cerrar modal"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-balance-title"
        className="relative max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-2xl sm:p-6"
      >
        {step === "form" ? (
          <>
            <h2
              id="add-balance-title"
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              Agregar saldo
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
              El monto es lo que pagás. El fee Holistic (
              {formatFeePercentLabel(feePercent)}) se descuenta y a la cartera
              llega el neto.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="topup-amount"
                  className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]"
                >
                  Monto a pagar (USD)
                </label>
                <Input
                  id="topup-amount"
                  type="number"
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  step="0.01"
                  placeholder="110.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                />
                {error && (
                  <p className="mt-1.5 text-xs text-red-600" role="alert">
                    {error}
                  </p>
                )}
              </div>

              {feePreview ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--admin-text-muted,#64748b)]">
                      Fee Holistic ({formatFeePercentLabel(feePercent)})
                    </span>
                    <span className="font-medium text-[var(--foreground)]">
                      {formatMoney(feePreview.feeCents / 100)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-2">
                    <span className="font-medium text-[var(--foreground)]">
                      Llega a tu cartera
                    </span>
                    <span className="text-base font-bold text-[var(--brand-primary,#ff781f)]">
                      {formatMoney(feePreview.creditCents / 100)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[var(--admin-text-muted,#64748b)]">
                    Ej.: pagás $110 con fee 10% → llegan $100 (no el 90% de
                    $110).
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Método seleccionado
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
                  {gatewayLabels[selectedGateway]}
                </p>
                {isVoucher ? (
                  <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
                    {selectedGateway === "crypto"
                      ? "Después enviás USDT y subís captura / TxID para revisión."
                      : "Después de crear la intención podrás subir el voucher para revisión."}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={handleClose}
                className="h-11 w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleContinueToConfirm}
                className="h-11 w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)] sm:w-auto"
              >
                Continuar
              </Button>
            </div>
          </>
        ) : step === "confirm" ? (
          <>
            <h2
              id="add-balance-title"
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              Confirmar depósito
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
              Se cobrará el bruto; a la cartera se acredita el neto tras el fee
              Hecom.
            </p>
            <dl className="mt-5 space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 text-sm">
              <div>
                <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Pagás
                </dt>
                <dd className="text-lg font-bold text-[var(--foreground)]">
                  {formatMoney(parsedAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Fee ({formatFeePercentLabel(feePercent)})
                </dt>
                <dd className="font-medium text-[var(--foreground)]">
                  {feePreview
                    ? formatMoney(feePreview.feeCents / 100)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Llega a cartera
                </dt>
                <dd className="text-lg font-bold text-[var(--brand-primary,#ff781f)]">
                  {feePreview
                    ? formatMoney(feePreview.creditCents / 100)
                    : formatMoney(parsedAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Pasarela
                </dt>
                <dd className="font-medium text-[var(--foreground)]">
                  {gatewayLabels[selectedGateway]}
                </dd>
              </div>
            </dl>
            {error && (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setStep("form")}
                disabled={loading}
              >
                Volver
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
              >
                {loading ? "Procesando…" : "Confirmar depósito"}
              </Button>
            </div>
          </>
        ) : step === "proof" ? (
          <>
            <h2
              id="add-balance-title"
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              {selectedGateway === "crypto"
                ? "Subir comprobante cripto"
                : "Subir voucher"}
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
              {selectedGateway === "crypto"
                ? "Adjuntá captura de Binance / wallet o TxID para que el equipo confirme el USDT desde el panel admin."
                : "Adjuntá el comprobante de transferencia para que el equipo lo revise desde el panel admin."}
            </p>
            <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 text-sm">
              <p className="font-semibold text-[var(--foreground)]">
                Pagás {formatMoney(parsedAmount)}
                {feePreview
                  ? ` · llegan ${formatMoney(feePreview.creditCents / 100)}`
                  : null}
              </p>
              <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
                ID de intención:{" "}
                <span className="font-mono">{paymentIntentId}</span>
              </p>
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {selectedGateway === "crypto"
                  ? "Captura / TxID"
                  : "Voucher o comprobante"}
              </label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1.5 text-xs text-[var(--admin-text-muted,#64748b)]">
                Formatos permitidos: JPG, PNG, WEBP o PDF. Máximo 10 MB.
              </p>
            </div>
            {error && (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={uploadingProof}
              >
                Subir luego
              </Button>
              <Button
                onClick={handleProofUpload}
                disabled={uploadingProof}
                className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
              >
                {uploadingProof
                  ? "Subiendo…"
                  : selectedGateway === "crypto"
                    ? "Enviar comprobante"
                    : "Enviar voucher"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2
              id="add-balance-title"
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              Intención registrada
            </h2>
            <p className="mt-3 text-sm text-[var(--admin-text-muted,#64748b)]">
              {resultMessage}
            </p>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleClose}
                className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
              >
                Cerrar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
