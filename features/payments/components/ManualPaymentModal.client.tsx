"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import {
  depositFromDesiredCredit,
  formatFeePercentLabel,
} from "@/lib/payments/deposit-fee";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";

type ChargeCurrency = "USD" | "PEN";
type Step = "form" | "banks" | "voucher" | "analyzing" | "confirmed" | "pending";

type BankAccount = {
  id: string;
  label: string;
  bank?: string;
  holder: string;
  accountNumber: string;
  cci?: string;
  notes?: string;
};

type ManualConfig = {
  fxRateUsdPen: number;
  bankAccounts: BankAccount[];
  bankAccountsUsd: BankAccount[];
  aiEnabled: boolean;
};

interface ManualPaymentModalProps {
  open: boolean;
  onClose: () => void;
  feePercent?: number;
}

interface CreateIntentResponse {
  ok: boolean;
  paymentIntent: {
    paymentIntentId: string;
    creditCents: number;
    grossCents: number;
    grossChargeCents?: number;
    chargeCurrency?: ChargeCurrency;
    fxRateUsdPen?: number;
  };
}

interface ProofResponse {
  ok: boolean;
  paymentIntent: {
    autoApproved: boolean;
    creditUsdCents?: number;
    analysis?: { reason?: string; confirmed?: boolean };
  };
}

const MIN_USD = 10;
const MAX_USD = 50_000;

function buildPenQuote(creditUsd: number, feePercent: number, rate: number) {
  const usd = depositFromDesiredCredit(Math.round(creditUsd * 100), feePercent);
  const creditPenCents = Math.round(creditUsd * rate * 100);
  const grossPenCents = Math.round(creditPenCents * (1 + feePercent / 100));
  return {
    creditUsdCents: usd.creditCents,
    grossUsdCents: usd.grossCents,
    feeUsdCents: usd.feeCents,
    creditPenCents,
    grossPenCents,
    feePenCents: grossPenCents - creditPenCents,
  };
}

export function ManualPaymentModal({
  open,
  onClose,
  feePercent = 10,
}: ManualPaymentModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("");
  const [chargeCurrency, setChargeCurrency] = useState<ChargeCurrency>("PEN");
  const [config, setConfig] = useState<ManualConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [creditResult, setCreditResult] = useState<number | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void apiClient<ManualConfig>("/api/payments/manual/config")
      .then(setConfig)
      .catch(() =>
        setConfig({
          fxRateUsdPen: 3.48,
          bankAccounts: [],
          bankAccountsUsd: [],
          aiEnabled: false,
        }),
      );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const parsedAmount = Number.parseFloat(amount);
  const rate = config?.fxRateUsdPen ?? 3.48;
  const isValidAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_USD &&
    parsedAmount <= MAX_USD;

  const quote = useMemo(() => {
    if (!isValidAmount) return null;
    const usd = depositFromDesiredCredit(
      Math.round(parsedAmount * 100),
      feePercent,
    );
    const pen = buildPenQuote(parsedAmount, feePercent, rate);
    return { usd, pen };
  }, [feePercent, isValidAmount, parsedAmount, rate]);

  const banks =
    chargeCurrency === "PEN"
      ? (config?.bankAccounts ?? [])
      : (config?.bankAccountsUsd ?? []);

  const chargeLabel =
    quote && chargeCurrency === "PEN"
      ? formatPenAmount(quote.pen.grossPenCents)
      : quote
        ? formatMoney(quote.usd.grossCents / 100)
        : "—";

  function resetAndClose() {
    setStep("form");
    setAmount("");
    setChargeCurrency("PEN");
    setError(null);
    setPaymentIntentId(null);
    setProofFile(null);
    setProofPreview(null);
    setCreditResult(null);
    setPendingMessage(null);
    onClose();
  }

  function applyProofFile(file: File) {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Usá JPG, PNG, WEBP o PDF.");
      return;
    }
    setProofFile(file);
    setError(null);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setProofPreview(url);
    } else {
      setProofPreview(null);
    }
  }

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          applyProofFile(
            new File([file], `pasted-${Date.now()}.png`, { type: file.type }),
          );
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (step !== "voucher") return;
    const zone = pasteZoneRef.current;
    if (!zone) return;
    zone.addEventListener("paste", handlePaste);
    return () => zone.removeEventListener("paste", handlePaste);
  }, [handlePaste, step]);

  async function handleCreateIntent() {
    if (!isValidAmount || !quote) {
      setError(`Monto entre ${formatMoney(MIN_USD)} y ${formatMoney(MAX_USD)}.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<CreateIntentResponse>("/api/payments/intents", {
        method: "POST",
        body: JSON.stringify({
          amount: parsedAmount,
          provider: "manual",
          chargeCurrency,
        }),
      });
      setPaymentIntentId(data.paymentIntent.paymentIntentId);
      setStep("banks");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo crear la recarga.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitVoucher() {
    if (!paymentIntentId || !proofFile) {
      setError("Subí o pegá el comprobante de pago.");
      return;
    }
    setStep("analyzing");
    setError(null);
    const formData = new FormData();
    formData.append("proof", proofFile);
    try {
      const data = await apiClient<ProofResponse>(
        `/api/payments/intents/${paymentIntentId}/proof`,
        { method: "POST", body: formData },
      );
      const credit = (data.paymentIntent.creditUsdCents ?? 0) / 100;
      setCreditResult(credit);
      if (data.paymentIntent.autoApproved) {
        setStep("confirmed");
        router.refresh();
      } else {
        setPendingMessage(
          data.paymentIntent.analysis?.reason ??
            "Comprobante en revisión. Te avisamos cuando se acredite.",
        );
        setStep("pending");
      }
    } catch (err) {
      setStep("voucher");
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo procesar el comprobante.",
      );
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/45 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[min(92vh,calc(100dvh-1rem))] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#ece7e0] bg-white shadow-2xl"
      >
        <div className="h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]" />

        {step === "form" ? (
          <div className="p-5 sm:p-6">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
              Pago manual
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#1c1917]">
              Recargar cartera
            </h2>
            <p className="mt-1 text-sm text-[#5c564e]">
              Elegí cuánto querés en cartera (USD). Transferís y subís el
              comprobante.
            </p>

            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-medium text-[#8a8177]">
                Quiero en cartera (USD)
              </label>
              <Input
                type="number"
                min={MIN_USD}
                max={MAX_USD}
                step="0.01"
                placeholder="120.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-[#8a8177]">
                Pagar en
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["PEN", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChargeCurrency(c)}
                    className={`h-11 rounded-xl border text-sm font-semibold transition ${
                      chargeCurrency === c
                        ? "border-[#ff781f] bg-[#fff1e8] text-[#c45a18]"
                        : "border-[#ece7e0] bg-white text-[#5c564e] hover:border-[#ff781f]/40"
                    }`}
                  >
                    {c === "PEN" ? "Soles (PEN)" : "Dólares (USD)"}
                  </button>
                ))}
              </div>
            </div>

            {quote ? (
              <div className="mt-4 space-y-2 rounded-xl border border-[#ece7e0] bg-[#faf8f5] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8a8177]">Llega a cartera</span>
                  <span className="font-bold text-[#1c1917]">
                    {formatMoney(quote.usd.creditCents / 100)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8a8177]">
                    Fee {formatFeePercentLabel(feePercent)}
                  </span>
                  <span className="font-medium">
                    {chargeCurrency === "PEN"
                      ? formatPenAmount(quote.pen.feePenCents)
                      : formatMoney(quote.usd.feeCents / 100)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#ece7e0] pt-2">
                  <span className="font-semibold text-[#1c1917]">
                    Transferís
                  </span>
                  <span className="text-lg font-bold text-[#ff781f]">
                    {chargeLabel}
                  </span>
                </div>
                {chargeCurrency === "PEN" ? (
                  <p className="text-[11px] text-[#8a8177]">
                    TC Holistic: 1 USD = {rate.toFixed(4)} PEN (fijado al
                    confirmar)
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={resetAndClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleCreateIntent}
                disabled={!isValidAmount || loading}
                className="flex-1 bg-[#ff781f] hover:bg-[#e85a1c]"
              >
                {loading ? "Preparando…" : "Continuar"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "banks" ? (
          <div className="p-5 sm:p-6">
            <h2 className="text-lg font-bold text-[#1c1917]">
              Transferí {chargeLabel}
            </h2>
            <p className="mt-1 text-sm text-[#5c564e]">
              Usá una de estas cuentas. Después subís el comprobante.
            </p>

            <div className="mt-4 space-y-3">
              {banks.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Cuentas bancarias pendientes de configuración. Contactá a
                  soporte.
                </p>
              ) : (
                banks.map((bank) => (
                  <div
                    key={bank.id}
                    className="rounded-xl border border-[#ece7e0] bg-[#faf8f5] p-4"
                  >
                    <p className="text-sm font-bold text-[#1c1917]">
                      {bank.label}
                    </p>
                    <p className="mt-1 text-xs text-[#5c564e]">{bank.holder}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-[#1c1917]">
                        {bank.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyText(bank.accountNumber)}
                        className="shrink-0 text-xs font-semibold text-[#ff781f] hover:underline"
                      >
                        Copiar
                      </button>
                    </div>
                    {bank.cci ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#8a8177]">
                          CCI: {bank.cci}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyText(bank.cci!)}
                          className="text-xs font-semibold text-[#ff781f] hover:underline"
                        >
                          Copiar
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => setStep("form")}>
                Volver
              </Button>
              <Button
                className="flex-1 bg-[#ff781f] hover:bg-[#e85a1c]"
                onClick={() => setStep("voucher")}
              >
                Ya pagué · Subir comprobante
              </Button>
            </div>
          </div>
        ) : null}

        {step === "voucher" ? (
          <div
            ref={pasteZoneRef}
            tabIndex={0}
            className="p-5 outline-none sm:p-6"
          >
            <h2 className="text-lg font-bold text-[#1c1917]">
              Subir comprobante
            </h2>
            <p className="mt-1 text-sm text-[#5c564e]">
              Pegá captura (Ctrl+V), elegí de galería o subí archivo.
            </p>

            <div
              className={`mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition ${
                proofFile
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-[#ece7e0] bg-[#faf8f5] hover:border-[#ff781f]/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter") fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
            >
              {proofPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proofPreview}
                  alt="Vista previa"
                  className="max-h-32 rounded-lg object-contain"
                />
              ) : proofFile ? (
                <p className="text-sm font-medium text-emerald-800">
                  {proofFile.name}
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#1c1917]">
                    Clic para subir o pegá aquí
                  </p>
                  <p className="mt-1 text-xs text-[#8a8177]">
                    JPG, PNG, WEBP o PDF · máx. 10 MB
                  </p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) applyProofFile(f);
              }}
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Galería / archivo
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => pasteZoneRef.current?.focus()}
              >
                Pegar captura
              </Button>
            </div>

            {error ? (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => setStep("banks")}>
                Volver
              </Button>
              <Button
                disabled={!proofFile}
                className="flex-1 bg-[#ff781f] hover:bg-[#e85a1c]"
                onClick={handleSubmitVoucher}
              >
                Verificar y acreditar
              </Button>
            </div>
          </div>
        ) : null}

        {step === "analyzing" ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ff781f]/25 border-t-[#ff781f]" />
            <p className="mt-5 text-lg font-bold text-[#1c1917]">
              Analizando comprobante…
            </p>
            <p className="mt-2 max-w-xs text-sm text-[#5c564e]">
              Estamos verificando monto y datos del voucher. Unos segundos.
            </p>
          </div>
        ) : null}

        {step === "confirmed" ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              ✓
            </div>
            <p className="mt-5 text-xl font-bold text-emerald-800">
              ¡Confirmado!
            </p>
            <p className="mt-2 text-sm text-[#5c564e]">
              Tu saldo ya está disponible en cartera.
            </p>
            <p className="mt-4 text-2xl font-bold tabular-nums text-[#1c1917]">
              {formatMoney(creditResult ?? parsedAmount)}
            </p>
            <p className="mt-1 text-xs text-[#8a8177]">
              Podés asignarlo a tus cuentas TikTok.
            </p>
            <Button
              className="mt-8 w-full bg-[#ff781f] hover:bg-[#e85a1c]"
              onClick={resetAndClose}
            >
              Listo
            </Button>
          </div>
        ) : null}

        {step === "pending" ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl">
              ⏳
            </div>
            <p className="mt-5 text-lg font-bold text-[#1c1917]">
              En revisión
            </p>
            <p className="mt-2 text-sm text-[#5c564e]">{pendingMessage}</p>
            <Button
              className="mt-8 w-full bg-[#ff781f] hover:bg-[#e85a1c]"
              onClick={resetAndClose}
            >
              Entendido
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
