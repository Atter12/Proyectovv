"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { PaymentGatewayId } from "@/types/payment";

interface AddBalanceModalProps {
  open: boolean;
  onClose: () => void;
  selectedGateway?: PaymentGatewayId;
}

interface CreateIntentResponse {
  ok: boolean;
  paymentIntent: {
    paymentIntentId: string;
    status: string;
    checkoutUrl: string | null;
    providerConfigured: boolean;
    message?: string;
  };
}

const gatewayLabels: Record<PaymentGatewayId, string> = {
  stripe: "Stripe",
  culqi: "Culqi",
  mercadopago: "Mercado Pago",
  manual: "Pago manual",
};

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100_000;

export function AddBalanceModal({
  open,
  onClose,
  selectedGateway = "stripe",
}: AddBalanceModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "result">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!open) return null;

  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_AMOUNT &&
    parsedAmount <= MAX_AMOUNT;

  function handleClose() {
    setStep("form");
    setAmount("");
    setError(null);
    setResultMessage(null);
    setLoading(false);
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

      setResultMessage(
        data.paymentIntent.message ??
          (data.paymentIntent.providerConfigured
            ? "Intención de pago creada. Te avisaremos cuando se confirme el depósito."
            : "La pasarela aún no está configurada. Se registró una intención pendiente."),
      );
      setStep("result");
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/40 backdrop-blur-sm"
        aria-label="Cerrar modal"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xl sm:p-6"
      >
        {step === "form" ? (
          <>
            <h2 className="text-lg font-semibold text-[#0f172a]">Agregar saldo</h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Recarga tu cartera mediante la pasarela seleccionada.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="topup-amount"
                  className="mb-1.5 block text-xs font-medium text-[#64748b]"
                >
                  Monto (USD)
                </label>
                <Input
                  id="topup-amount"
                  type="number"
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  step="0.01"
                  placeholder="100.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {error && (
                  <p className="mt-1.5 text-xs text-red-600" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-[#e5e7eb] bg-slate-50 px-4 py-3">
                <p className="text-xs text-[#64748b]">Método seleccionado</p>
                <p className="mt-0.5 text-sm font-semibold text-[#0f172a]">
                  {gatewayLabels[selectedGateway]}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleClose} className="h-11 w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                onClick={handleContinueToConfirm}
                className="h-11 w-full bg-[#4056ff] hover:bg-[#4056ff]/90 sm:w-auto"
              >
                Continuar
              </Button>
            </div>
          </>
        ) : step === "confirm" ? (
          <>
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Confirmar depósito
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Se creará una intención de pago real en tu organización.
            </p>
            <dl className="mt-5 space-y-3 rounded-xl border border-[#e5e7eb] bg-slate-50 p-4 text-sm">
              <div>
                <dt className="text-xs text-[#64748b]">Monto</dt>
                <dd className="text-lg font-bold text-[#0f172a]">
                  {formatMoney(parsedAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#64748b]">Pasarela</dt>
                <dd className="font-medium text-[#0f172a]">
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
              <Button variant="outline" onClick={() => setStep("form")} disabled={loading}>
                Volver
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="bg-[#4056ff] hover:bg-[#4056ff]/90"
              >
                {loading ? "Procesando…" : "Confirmar depósito"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Intención registrada
            </h2>
            <p className="mt-3 text-sm text-[#64748b]">{resultMessage}</p>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleClose} className="bg-[#4056ff] hover:bg-[#4056ff]/90">
                Cerrar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
