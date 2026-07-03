"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format-money";
import type { PaymentGatewayId } from "@/types/payment";

interface AddBalanceModalProps {
  open: boolean;
  onClose: () => void;
  selectedGateway?: PaymentGatewayId;
}

const gatewayLabels: Record<PaymentGatewayId, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  payoneer: "Payoneer",
  usdt: "USDT",
  airwallex: "Airwallex",
};

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100_000;

export function AddBalanceModal({
  open,
  onClose,
  selectedGateway = "stripe",
}: AddBalanceModalProps) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [error, setError] = useState<string | null>(null);

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

  function handleConfirm() {
    handleClose();
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
              Vista mock — el monto no se procesa ni guarda.
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
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Confirmar depósito mock
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Esta acción no procesará un pago real.
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
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setStep("form")}>
                Volver
              </Button>
              <Button
                onClick={handleConfirm}
                className="bg-[#4056ff] hover:bg-[#4056ff]/90"
              >
                Confirmar depósito mock
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
