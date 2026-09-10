"use client";

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import {
  formatFeePercentLabel,
  depositFromDesiredCredit,
  effectiveDepositFeePercent,
  DEFAULT_STRIPE_DEPOSIT_SURCHARGE_PERCENT,
} from "@/lib/payments/deposit-fee";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
import { COBRANA_YAPE_SERVICE_COMPANY } from "@/lib/payments/cobrana/service-brand";
import { normalizeYapeDocument } from "@/lib/payments/cobrana/document";
import type { PaymentGatewayId } from "@/types/payment";
import { isVoucherPaymentProvider } from "@/types/payment";
import {
  PaymentAppIcon,
  paymentAppButtonClass,
  paymentAppLabel,
  resolvePaymentAppKey,
} from "./PaymentAppIcon";
import { cn } from "@/lib/cn";
import { GatewayLogo } from "./GatewayLogo";
import {
  CheckCircleIcon,
  ClockIcon,
  PaymentModalFooter,
  PaymentModalHeader,
} from "./PaymentModalChrome";

interface AddBalanceModalProps {
  open: boolean;
  onClose: () => void;
  selectedGateway?: PaymentGatewayId;
  /** Fee % Hecom (tiktok_default_fee / cuenta). Sin surcharge Stripe. */
  feePercent?: number;
  /** Recargo pasarela Stripe (default 3). Solo si gateway = stripe. */
  stripeSurchargePercent?: number;
}

type CobranaDeeplink = { key: string; label: string; url: string };

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
    grossPenCents?: number | null;
    fxRateUsdPen?: number;
    cobranaCode?: string | null;
    cobranaDeeplinks?: CobranaDeeplink[];
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

interface IntentPollResponse {
  ok: boolean;
  paymentIntent: {
    id: string;
    status: string;
    cobranaCode?: string | null;
    cobranaDeeplinks?: CobranaDeeplink[];
  };
}

const gatewayLabels: Record<PaymentGatewayId, string> = {
  stripe: "Stripe",
  culqi: "Culqi",
  mercadopago: "Mercado Pago",
  crypto: "Cripto (USDT)",
  manual: "Pago manual",
  cobrana: "Yape / Plin",
};

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100_000;
const DEFAULT_FX = 3.48;

const subscribeToNothing = () => () => {};

type Step = "form" | "confirm" | "proof" | "yape" | "result";

const ADD_BALANCE_STEPS = ["Monto", "Confirmación", "Pago"] as const;

export function AddBalanceModal({
  open,
  onClose,
  selectedGateway = "stripe",
  feePercent = 10,
  stripeSurchargePercent = DEFAULT_STRIPE_DEPOSIT_SURCHARGE_PERCENT,
}: AddBalanceModalProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [fxRate, setFxRate] = useState(DEFAULT_FX);
  const [fxSourceLabel, setFxSourceLabel] = useState("TC referencial");
  const [cobranaCode, setCobranaCode] = useState<string | null>(null);
  const [cobranaDeeplinks, setCobranaDeeplinks] = useState<CobranaDeeplink[]>(
    [],
  );
  const [codeCopied, setCodeCopied] = useState(false);
  const [paidConfirmed, setPaidConfirmed] = useState(false);
  const [needsCustomerDocument, setNeedsCustomerDocument] = useState(false);
  const [customerDocument, setCustomerDocument] = useState("");
  const [crmDocumentHint, setCrmDocumentHint] = useState<string | null>(null);

  const isCobrana = selectedGateway === "cobrana";
  const isStripe = selectedGateway === "stripe";
  const stripeExtra = isStripe ? Math.max(0, stripeSurchargePercent) : 0;
  const chargeFeePercent = effectiveDepositFeePercent({
    holisticFeePercent: feePercent,
    provider: selectedGateway,
    stripeSurchargePercent: stripeExtra,
  });
  const parsedAmount = Number.parseFloat(amount);

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

  useEffect(() => {
    if (!open || !isCobrana) return;
    void apiClient<{
      fxRateUsdPen: number;
      fxSource?: string;
      fxAsOf?: string | null;
    }>("/api/payments/manual/config")
      .then((cfg) => {
        if (Number.isFinite(cfg.fxRateUsdPen) && cfg.fxRateUsdPen > 0) {
          setFxRate(cfg.fxRateUsdPen);
        }
        const src = (cfg.fxSource ?? "").toLowerCase();
        if (src === "sbs") {
          setFxSourceLabel(
            cfg.fxAsOf ? `TC SBS venta (${cfg.fxAsOf})` : "TC SBS venta",
          );
        } else {
          setFxSourceLabel("TC referencial");
        }
      })
      .catch(() => {
        /* keep default FX */
      });
  }, [open, isCobrana]);

  useEffect(() => {
    if (!open || !isCobrana || step !== "confirm") return;
    let cancelled = false;
    void apiClient<{
      ok: boolean;
      needsDocument: boolean;
      crmDocument: string | null;
      message: string | null;
    }>("/api/payments/cobrana/document")
      .then((data) => {
        if (cancelled) return;
        setNeedsCustomerDocument(Boolean(data.needsDocument));
        setCrmDocumentHint(
          data.needsDocument && data.crmDocument ? data.crmDocument : null,
        );
      })
      .catch(() => {
        if (cancelled) return;
        // Ante duda, pedir DNI: mejor UX que bloquear con error opaco.
        setNeedsCustomerDocument(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isCobrana, step]);

  useEffect(() => {
    if (!open || step !== "yape" || !paymentIntentId || paidConfirmed) return;

    let cancelled = false;

    async function poll() {
      try {
        const data = await apiClient<IntentPollResponse>(
          `/api/payments/intents/${paymentIntentId}`,
        );
        if (cancelled) return;
        if (data.paymentIntent.cobranaCode) {
          setCobranaCode(data.paymentIntent.cobranaCode);
        }
        if (data.paymentIntent.cobranaDeeplinks?.length) {
          setCobranaDeeplinks(data.paymentIntent.cobranaDeeplinks);
        }
        if (data.paymentIntent.status === "succeeded") {
          setPaidConfirmed(true);
          setResultMessage(
            `Pago confirmado. Se acreditaron ${formatMoney(parsedAmount)} en tu cartera.`,
          );
          setStep("result");
          router.refresh();
        }
      } catch {
        /* keep waiting — webhook is source of truth */
      }
    }

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, step, paymentIntentId, paidConfirmed, router, parsedAmount]);

  const isValidAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_AMOUNT &&
    parsedAmount <= MAX_AMOUNT;
  const isVoucher = isVoucherPaymentProvider(selectedGateway);

  const feePreview = useMemo(() => {
    if (!isValidAmount) return null;
    return depositFromDesiredCredit(
      Math.round(parsedAmount * 100),
      chargeFeePercent,
    );
  }, [chargeFeePercent, isValidAmount, parsedAmount]);

  const penPreview = useMemo(() => {
    if (!isCobrana || !isValidAmount) return null;
    const creditPenCents = Math.round(parsedAmount * fxRate * 100);
    const grossPenCents = Math.round(
      creditPenCents * (1 + chargeFeePercent / 100),
    );
    return {
      creditPenCents,
      feePenCents: Math.max(0, grossPenCents - creditPenCents),
      grossPenCents,
    };
  }, [chargeFeePercent, fxRate, isCobrana, isValidAmount, parsedAmount]);

  function handleClose() {
    setStep("form");
    setAmount("");
    setError(null);
    setResultMessage(null);
    setPaymentIntentId(null);
    setProofFile(null);
    setLoading(false);
    setUploadingProof(false);
    setCobranaCode(null);
    setCobranaDeeplinks([]);
    setPaidConfirmed(false);
    setNeedsCustomerDocument(false);
    setCustomerDocument("");
    setCrmDocumentHint(null);
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
      if (isCobrana && needsCustomerDocument) {
        const doc = normalizeYapeDocument(customerDocument);
        if (!doc.ok) {
          setError(doc.message);
          setLoading(false);
          return;
        }
      }

      const data = await apiClient<CreateIntentResponse>(
        "/api/payments/intents",
        {
          method: "POST",
          body: JSON.stringify({
            amount: parsedAmount,
            currency: "USD",
            provider: selectedGateway,
            ...(isCobrana ? { chargeCurrency: "PEN" } : {}),
            ...(isCobrana && needsCustomerDocument
              ? { customerDocument: customerDocument.replace(/\D/g, "") }
              : {}),
          }),
        },
      );

      if (data.paymentIntent.checkoutUrl) {
        window.location.assign(data.paymentIntent.checkoutUrl);
        return;
      }

      setPaymentIntentId(data.paymentIntent.paymentIntentId);

      if (isCobrana) {
        setCobranaCode(data.paymentIntent.cobranaCode ?? null);
        setCobranaDeeplinks(data.paymentIntent.cobranaDeeplinks ?? []);
        setResultMessage(data.paymentIntent.message ?? null);
        setStep("yape");
        router.refresh();
        return;
      }

      const chargeLabel =
        data.paymentIntent.grossCents != null
          ? formatMoney(data.paymentIntent.grossCents / 100)
          : feePreview
            ? formatMoney(feePreview.grossCents / 100)
            : formatMoney(parsedAmount);
      const defaultMessage = data.paymentIntent.providerConfigured
        ? `Solicitud creada. Recibirás ${formatMoney(parsedAmount)} en la cartera y se cobrará ${chargeLabel} (fee ${formatFeePercentLabel(chargeFeePercent)}).`
        : "La pasarela aún no está configurada. Se registró una intención pendiente.";

      setResultMessage(data.paymentIntent.message ?? defaultMessage);
      setStep(isVoucher ? "proof" : "result");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "No se pudo crear la intención de pago.";
      if (
        isCobrana &&
        /NEED_CUSTOMER_DOCUMENT|DNI \(8|RUC \(11|documento|Ingresa tu DNI/i.test(
          message,
        )
      ) {
        setNeedsCustomerDocument(true);
      }
      setError(message);
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

  const yapeLink =
    cobranaDeeplinks.find((d) => d.key.toLowerCase() === "yape") ?? null;
  const otherLinks = cobranaDeeplinks.filter(
    (d) => d.key.toLowerCase() !== "yape",
  );
  const orderedLinks = [...(yapeLink ? [yapeLink] : []), ...otherLinks];
  const modalStepIndex = step === "form" ? 0 : step === "confirm" ? 1 : 2;
  const gatewayIdentityDescription = isCobrana
    ? "Yape, Plin y bancos"
    : isStripe
      ? "Tarjetas Visa y Mastercard"
      : "Recarga de cartera";

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/55 backdrop-blur-[2px]"
        aria-label="Cerrar modal"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-balance-title"
        className="scrollbar-thin relative max-h-[min(92vh,calc(100dvh-1.5rem))] w-full max-w-[35rem] overflow-y-auto rounded-[1.25rem] bg-white shadow-[0_28px_90px_rgb(15_23_42_/_0.24)]"
      >
        {step === "form" ? (
          <>
            <PaymentModalHeader
              titleId="add-balance-title"
              title="¿Cuánto saldo quieres recargar?"
              description={
                isCobrana
                  ? "Ingresa el saldo que deseas recibir en USD. Calcularemos el pago equivalente en soles para Yape, Plin o tu banco."
                  : isStripe
                    ? "Ingresa el saldo que deseas recibir. Antes de pagar verás el total exacto, incluidos los fees."
                    : "Ingresa el saldo que deseas recibir en tu cartera Holistic."
              }
              identityIcon={
                <GatewayLogo gatewayId={selectedGateway} size="sm" />
              }
              identityLabel={gatewayLabels[selectedGateway]}
              identityDescription={gatewayIdentityDescription}
              steps={ADD_BALANCE_STEPS}
              currentStep={modalStepIndex}
              onClose={handleClose}
            />

            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <label
                  htmlFor="topup-amount"
                  className="mb-2 block text-[12px] font-semibold text-[#514b45]"
                >
                  Saldo que recibirás (USD)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-[#8a8177]">
                    $
                  </span>
                  <Input
                    id="topup-amount"
                    type="number"
                    min={MIN_AMOUNT}
                    max={MAX_AMOUNT}
                    step="0.01"
                    placeholder="100.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                    className="h-14 rounded-xl pl-9 text-lg font-semibold tabular-nums"
                  />
                </div>
                {error && (
                  <p
                    className="mt-2 text-xs font-medium text-red-600"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>

              {feePreview ? (
                <div className="rounded-2xl bg-[#f7f5f2] p-4 text-sm sm:p-5">
                  <p className="mb-3 text-[13px] font-semibold text-[#1c1917]">
                    Resumen de la recarga
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#625b54]">Recibirás en cartera</span>
                    <span className="font-semibold tabular-nums text-[#1c1917]">
                      {formatMoney(feePreview.creditCents / 100)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[#625b54]">
                      Fee Holistic ({formatFeePercentLabel(feePercent)})
                    </span>
                    <span className="font-medium tabular-nums text-[#1c1917]">
                      {isCobrana && penPreview
                        ? formatPenAmount(penPreview.feePenCents)
                        : formatMoney((parsedAmount * feePercent) / 100)}
                    </span>
                  </div>
                  {isStripe && stripeExtra > 0 ? (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-[#625b54]">
                        Fee de Stripe ({formatFeePercentLabel(stripeExtra)})
                      </span>
                      <span className="font-medium tabular-nums text-[#1c1917]">
                        {formatMoney((parsedAmount * stripeExtra) / 100)}
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#e4ddd6] pt-3">
                    <span className="font-semibold text-[#1c1917]">
                      Total a pagar
                    </span>
                    <span className="text-xl font-semibold tracking-[-0.02em] tabular-nums text-[#e85a1c]">
                      {isCobrana && penPreview
                        ? formatPenAmount(penPreview.grossPenCents)
                        : formatMoney(feePreview.grossCents / 100)}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] leading-4 text-[#6f675f]">
                    {isCobrana
                      ? `${fxSourceLabel} ${fxRate.toFixed(3)} · necesitas un DNI registrado en Hecom CRM.`
                      : isStripe
                        ? `Total fee ${formatFeePercentLabel(chargeFeePercent)} (Holistic + pasarela). Transferencia no lleva el +${formatFeePercentLabel(stripeExtra)}.`
                        : "Ej.: si quieres $100 con un fee de 10%, se cobran $110."}
                  </p>
                </div>
              ) : null}

              {isStripe ? (
                <div className="flex items-center justify-between gap-4 rounded-xl bg-[#fff8f3] px-4 py-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#1c1917]">
                      Paga con tarjeta
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6f675f]">
                      Procesamiento seguro mediante Stripe
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {(["visa", "mastercard"] as const).map((app) => (
                      <PaymentAppIcon key={app} app={app} size="sm" />
                    ))}
                  </div>
                </div>
              ) : isCobrana ? (
                <div className="rounded-xl bg-[#fbf7fc] px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[12px] font-semibold text-[#1c1917]">
                        Pago con Yape, Plin o bancos
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-[#6f675f]">
                        En Yape, el servicio aparecerá como{" "}
                        {COBRANA_YAPE_SERVICE_COMPANY}.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {(
                        [
                          "yape",
                          "plin",
                          "bcp",
                          "interbank",
                          "bbva",
                          "scotiabank",
                        ] as const
                      ).map((app) => (
                        <PaymentAppIcon key={app} app={app} size="sm" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : isVoucher ? (
                <p className="rounded-xl bg-[#f7f5f2] px-4 py-3 text-xs leading-5 text-[#625b54]">
                  {selectedGateway === "crypto"
                    ? "Checkout solo USDT (TRC20). Si NOWPayments no está activo, envía los USDT y sube una captura o el TxID."
                    : "Después de crear la solicitud podrás subir el comprobante para revisión."}
                </p>
              ) : null}

              <PaymentModalFooter>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="h-11 w-full rounded-xl sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleContinueToConfirm}
                  className="h-11 w-full rounded-xl bg-[var(--brand-primary)] px-6 hover:bg-[var(--brand-primary-deep)] sm:w-auto"
                >
                  Revisar recarga
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : step === "confirm" ? (
          <>
            <PaymentModalHeader
              titleId="add-balance-title"
              title="Revisa tu recarga"
              description={
                isCobrana
                  ? "Te daremos un código para pagar en soles desde Yape, Plin o tu banco."
                  : "Confirma que el saldo y el total a pagar sean correctos antes de continuar."
              }
              identityIcon={
                <GatewayLogo gatewayId={selectedGateway} size="sm" />
              }
              identityLabel={gatewayLabels[selectedGateway]}
              identityDescription={gatewayIdentityDescription}
              steps={ADD_BALANCE_STEPS}
              currentStep={modalStepIndex}
              onClose={handleClose}
            />

            <div className="p-5 sm:p-6">
              <div className="overflow-hidden rounded-2xl bg-[#f7f5f2]">
                <dl className="grid grid-cols-2 divide-x divide-[#e4ddd6]">
                  <div className="p-4 sm:p-5">
                    <dt className="text-[11px] font-medium text-[#6f675f]">
                      Recibirás
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tracking-[-0.025em] tabular-nums text-[#e85a1c]">
                      {formatMoney(parsedAmount)}
                    </dd>
                    <dd className="mt-0.5 text-[10px] text-[#8a8177]">
                      En tu cartera Holistic
                    </dd>
                  </div>
                  <div className="p-4 sm:p-5">
                    <dt className="text-[11px] font-medium text-[#6f675f]">
                      Total a pagar
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tracking-[-0.025em] tabular-nums text-[#1c1917]">
                      {isCobrana && penPreview
                        ? formatPenAmount(penPreview.grossPenCents)
                        : feePreview
                          ? formatMoney(feePreview.grossCents / 100)
                          : formatMoney(parsedAmount)}
                    </dd>
                    <dd className="mt-0.5 text-[10px] text-[#8a8177]">
                      Mediante {gatewayLabels[selectedGateway]}
                    </dd>
                  </div>
                </dl>

                <dl className="space-y-2 border-t border-[#e4ddd6] px-4 py-3 text-[12px] sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#625b54]">
                      Fee Holistic ({formatFeePercentLabel(feePercent)})
                    </dt>
                    <dd className="font-medium tabular-nums text-[#1c1917]">
                      {isCobrana && penPreview
                        ? formatPenAmount(penPreview.feePenCents)
                        : formatMoney((parsedAmount * feePercent) / 100)}
                    </dd>
                  </div>
                  {isStripe && stripeExtra > 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#625b54]">
                        Fee de Stripe ({formatFeePercentLabel(stripeExtra)})
                      </dt>
                      <dd className="font-medium tabular-nums text-[#1c1917]">
                        {formatMoney((parsedAmount * stripeExtra) / 100)}
                      </dd>
                    </div>
                  ) : null}
                  {isCobrana ? (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#625b54]">Servicio en Yape</dt>
                      <dd className="font-semibold text-[#1c1917]">
                        {COBRANA_YAPE_SERVICE_COMPANY}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              {isCobrana && needsCustomerDocument ? (
                <div className="mt-4 rounded-2xl border border-[#e7dfd7] bg-white px-4 py-4 sm:px-5">
                  <p className="text-[13px] font-semibold text-[#1c1917]">
                    Ingresa tu DNI
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#625b54]">
                    {crmDocumentHint
                      ? `En el CRM figura “${crmDocumentHint}”, que no sirve para Yape. Escribe tu DNI (8 dígitos) o RUC (11).`
                      : "Para pagar con Yape necesitamos tu DNI (8 dígitos) o RUC (11). Se guarda en tu ficha Hecom."}
                  </p>
                  <label className="mt-3 block">
                    <span className="text-[11px] font-medium text-[#6f675f]">
                      DNI o RUC
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej. 12345678"
                      maxLength={11}
                      value={customerDocument}
                      onChange={(e) =>
                        setCustomerDocument(
                          e.target.value.replace(/\D/g, "").slice(0, 11),
                        )
                      }
                      className="mt-1 h-11 rounded-xl border-[#ddd4cb] bg-[#f7f5f2] text-[1.05rem] font-semibold tabular-nums tracking-wide"
                    />
                  </label>
                </div>
              ) : null}

              {error && (
                <p
                  className="mt-3 text-xs font-medium text-red-600"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <PaymentModalFooter>
                <Button
                  variant="outline"
                  onClick={() => setStep("form")}
                  disabled={loading}
                  className="h-11 w-full rounded-xl sm:w-auto"
                >
                  Volver
                </Button>
                <Button
                  onClick={() => void handleConfirm()}
                  disabled={
                    loading ||
                    (isCobrana &&
                      needsCustomerDocument &&
                      !normalizeYapeDocument(customerDocument).ok)
                  }
                  className="h-11 w-full rounded-xl bg-[var(--brand-primary)] px-6 hover:bg-[var(--brand-primary-deep)] sm:w-auto"
                >
                  {loading
                    ? "Procesando…"
                    : isCobrana
                      ? "Continuar con Yape / Plin"
                      : "Pagar con Stripe"}
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : step === "yape" ? (
          <>
            <PaymentModalHeader
              titleId="add-balance-title"
              title="Completa el pago"
              description={
                resultMessage ??
                "Usa el código desde Yape, Plin o la app de tu banco para completar el pago en soles."
              }
              identityIcon={<GatewayLogo gatewayId="cobrana" size="sm" />}
              identityLabel="Yape / Plin"
              identityDescription="Yape, Plin y bancos"
              steps={ADD_BALANCE_STEPS}
              currentStep={modalStepIndex}
              onClose={handleClose}
            />

            <div className="p-5 sm:p-6">
              <div className="overflow-hidden rounded-2xl bg-[#f7f5f2]">
                <div className="border-b border-[#e4ddd6] px-4 py-4 sm:px-5">
                  <p className="text-[11px] font-medium text-[#6f675f]">
                    Busca este servicio en Yape
                  </p>
                  <div className="mt-1 flex items-end justify-between gap-4">
                    <p className="text-2xl font-semibold tracking-[-0.03em] text-[#1c1917]">
                      {COBRANA_YAPE_SERVICE_COMPANY}
                    </p>
                    <span className="rounded-full bg-[#eee5f1] px-2.5 py-1 text-[10px] font-semibold text-[#5f0b72]">
                      Pago de servicios
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[#6f675f]">
                    El servicio figura como {COBRANA_YAPE_SERVICE_COMPANY}, no
                    como Holistic.
                  </p>
                </div>
                {cobranaCode ? (
                  <div className="px-4 py-4 sm:px-5">
                    <p className="text-[11px] font-medium text-[#6f675f]">
                      Código de pago
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <p className="font-mono text-2xl font-semibold tracking-[0.04em] text-[#1c1917]">
                        {cobranaCode}
                      </p>
                      <button
                        type="button"
                        className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#ddd4cb] bg-white px-3 text-xs font-semibold text-[#1c1917] transition-colors hover:bg-[#fff8f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/35"
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(cobranaCode)
                            .then(() => {
                              setCodeCopied(true);
                              window.setTimeout(
                                () => setCodeCopied(false),
                                2000,
                              );
                            })
                            .catch(() => {
                              /* ignore */
                            });
                        }}
                      >
                        {codeCopied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="px-4 py-4 text-[12px] text-[#6f675f] sm:px-5">
                    Preparando tu código de pago…
                  </p>
                )}
                <div className="grid grid-cols-2 divide-x divide-[#e4ddd6] border-t border-[#e4ddd6] px-4 py-4 text-sm sm:px-5">
                  <div className="pr-4">
                    <p className="text-[10px] text-[#6f675f]">Pagarás</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-[#5f0b72]">
                      {penPreview
                        ? formatPenAmount(penPreview.grossPenCents)
                        : "—"}
                    </p>
                  </div>
                  <div className="pl-4">
                    <p className="text-[10px] text-[#6f675f]">Recibirás</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-[#1c1917]">
                      {formatMoney(parsedAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="mt-3 flex items-center gap-2 rounded-xl bg-[#fbf7fc] px-3.5 py-3 text-[12px] font-medium text-[#5f0b72]"
                role="status"
              >
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#8b1aa0]" />
                Esperando la confirmación automática del pago…
              </div>

              <div className="mt-5">
                <h3 className="text-[13px] font-semibold text-[#1c1917]">
                  Cómo pagar desde Yape
                </h3>
                <ol className="mt-3 space-y-3">
                  <PaymentInstruction
                    number="1"
                    text={
                      <>
                        Abre Yape e ingresa a <strong>Pago de servicios</strong>
                        .
                      </>
                    }
                  />
                  <PaymentInstruction
                    number="2"
                    text={
                      <>
                        Busca <strong>{COBRANA_YAPE_SERVICE_COMPANY}</strong> en
                        Compras online / Servicios.
                      </>
                    }
                  />
                  <PaymentInstruction
                    number="3"
                    text={
                      <>
                        Ingresa el código{" "}
                        <strong className="font-mono">
                          {cobranaCode ?? "HOL…"}
                        </strong>{" "}
                        y paga{" "}
                        <strong>
                          {penPreview
                            ? formatPenAmount(penPreview.grossPenCents)
                            : "el monto indicado"}
                        </strong>
                        .
                      </>
                    }
                  />
                  <PaymentInstruction
                    number="4"
                    text={
                      <>
                        Regresa aquí. Cuando el pago se confirme, acreditaremos{" "}
                        <strong>{formatMoney(parsedAmount)}</strong> en tu
                        cartera.
                      </>
                    }
                  />
                </ol>
              </div>

              {orderedLinks.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                    Si estás en el celular, también puedes abrir la aplicación
                    directamente:
                  </p>
                  <div className="flex flex-col gap-2">
                    {orderedLinks.map((link) => {
                      const app = resolvePaymentAppKey(link.key, link.label);
                      return (
                        <button
                          key={`${link.key}-${link.url}`}
                          type="button"
                          className={cn(
                            "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl px-4 text-sm font-semibold transition-colors",
                            paymentAppButtonClass(app),
                          )}
                          onClick={() => {
                            window.open(
                              link.url,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                        >
                          <PaymentAppIcon app={app} size="sm" />
                          Abrir {paymentAppLabel(app, link.label)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {error && (
                <p className="mt-3 text-xs text-red-600" role="alert">
                  {error}
                </p>
              )}

              <PaymentModalFooter>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="h-11 w-full rounded-xl sm:w-auto"
                >
                  Cerrar y esperar
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : step === "proof" ? (
          <>
            <PaymentModalHeader
              titleId="add-balance-title"
              title={
                selectedGateway === "crypto"
                  ? "Sube tu comprobante cripto"
                  : "Sube tu comprobante"
              }
              description={
                selectedGateway === "crypto"
                  ? "Adjunta una captura de Binance o de tu billetera, o el TxID, para confirmar los USDT."
                  : "Adjunta el comprobante de transferencia para enviarlo a revisión."
              }
              identityIcon={
                <GatewayLogo gatewayId={selectedGateway} size="sm" />
              }
              identityLabel={gatewayLabels[selectedGateway]}
              identityDescription={gatewayIdentityDescription}
              steps={ADD_BALANCE_STEPS}
              currentStep={modalStepIndex}
              onClose={handleClose}
            />
            <div className="p-5 sm:p-6">
              <div className="rounded-2xl bg-[#f7f5f2] p-4 text-sm">
                <p className="font-semibold text-[var(--foreground)]">
                  Recibirás {formatMoney(parsedAmount)}
                  {feePreview
                    ? ` · total ${formatMoney(feePreview.grossCents / 100)}`
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
              <PaymentModalFooter>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={uploadingProof}
                  className="h-11 w-full rounded-xl sm:w-auto"
                >
                  Subir luego
                </Button>
                <Button
                  onClick={handleProofUpload}
                  disabled={uploadingProof}
                  className="h-11 w-full rounded-xl bg-[var(--brand-primary)] px-6 hover:bg-[var(--brand-primary-deep)] sm:w-auto"
                >
                  {uploadingProof
                    ? "Subiendo…"
                    : selectedGateway === "crypto"
                      ? "Enviar comprobante"
                      : "Enviar voucher"}
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : (
          <>
            <PaymentModalHeader
              titleId="add-balance-title"
              title={paidConfirmed ? "Pago acreditado" : "Solicitud registrada"}
              description={
                paidConfirmed
                  ? "El saldo ya está disponible en tu cartera Holistic."
                  : "Guardamos la solicitud y podrás continuar cuando el pago sea confirmado."
              }
              identityIcon={
                <GatewayLogo gatewayId={selectedGateway} size="sm" />
              }
              identityLabel={gatewayLabels[selectedGateway]}
              identityDescription={gatewayIdentityDescription}
              steps={ADD_BALANCE_STEPS}
              currentStep={modalStepIndex}
              onClose={handleClose}
            />
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3 rounded-2xl bg-[#f7f5f2] p-4">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                    paidConfirmed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700",
                  )}
                >
                  {paidConfirmed ? <CheckCircleIcon /> : <ClockIcon />}
                </span>
                <p className="pt-1 text-sm leading-5 text-[#514b45]">
                  {resultMessage}
                </p>
              </div>
              <PaymentModalFooter>
                <Button
                  onClick={handleClose}
                  className="h-11 w-full rounded-xl bg-[var(--brand-primary)] px-6 hover:bg-[var(--brand-primary-deep)] sm:w-auto"
                >
                  Cerrar
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function PaymentInstruction({
  number,
  text,
}: {
  number: string;
  text: ReactNode;
}) {
  return (
    <li className="flex gap-3 text-[13px] leading-5 text-[#514b45]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fff1e8] text-[11px] font-semibold text-[#c65113]">
        {number}
      </span>
      <span className="pt-0.5">{text}</span>
    </li>
  );
}
