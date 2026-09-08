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
  depositFromDesiredCredit,
} from "@/lib/payments/deposit-fee";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
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

interface AddBalanceModalProps {
  open: boolean;
  onClose: () => void;
  selectedGateway?: PaymentGatewayId;
  /** Fee % Hecom (tiktok_default_fee / cuenta). */
  feePercent?: number;
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
  cobrana: "Yape",
};

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100_000;
const DEFAULT_FX = 3.48;

type Step = "form" | "confirm" | "proof" | "yape" | "result";

export function AddBalanceModal({
  open,
  onClose,
  selectedGateway = "stripe",
  feePercent = 10,
}: AddBalanceModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
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

  const isCobrana = selectedGateway === "cobrana";

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
            cfg.fxAsOf
              ? `TC SBS venta (${cfg.fxAsOf})`
              : "TC SBS venta",
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
    // parsedAmount is stable while on yape step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, paymentIntentId, paidConfirmed, router]);

  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= MIN_AMOUNT &&
    parsedAmount <= MAX_AMOUNT;
  const isVoucher = isVoucherPaymentProvider(selectedGateway);

  const feePreview = useMemo(() => {
    if (!isValidAmount) return null;
    return depositFromDesiredCredit(Math.round(parsedAmount * 100), feePercent);
  }, [feePercent, isValidAmount, parsedAmount]);

  const penPreview = useMemo(() => {
    if (!isCobrana || !isValidAmount) return null;
    const creditPenCents = Math.round(parsedAmount * fxRate * 100);
    const grossPenCents = Math.round(creditPenCents * (1 + feePercent / 100));
    return {
      creditPenCents,
      feePenCents: grossPenCents - creditPenCents,
      grossPenCents,
    };
  }, [feePercent, fxRate, isCobrana, isValidAmount, parsedAmount]);

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
          ...(isCobrana ? { chargeCurrency: "PEN" } : {}),
        }),
      });

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
        ? `Intención creada. Querés ${formatMoney(parsedAmount)} en cartera; se cobra ${chargeLabel} (fee ${formatFeePercentLabel(feePercent)}).`
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

  const yapeLink =
    cobranaDeeplinks.find((d) => d.key.toLowerCase() === "yape") ?? null;
  const otherLinks = cobranaDeeplinks.filter(
    (d) => d.key.toLowerCase() !== "yape",
  );
  const orderedLinks = [
    ...(yapeLink ? [yapeLink] : []),
    ...otherLinks,
  ];

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
              Indicá cuánto querés en cartera. El fee Holistic (
              {formatFeePercentLabel(feePercent)}) se suma
              {isCobrana
                ? " y se cobra en soles vía Yape."
                : " y eso es lo que se cobra."}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="topup-amount"
                  className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]"
                >
                  Quiero en cartera (USD)
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
                      Llega a tu cartera
                    </span>
                    <span className="font-medium text-[var(--foreground)]">
                      {formatMoney(feePreview.creditCents / 100)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[var(--admin-text-muted,#64748b)]">
                      Fee Holistic ({formatFeePercentLabel(feePercent)})
                    </span>
                    <span className="font-medium text-[var(--foreground)]">
                      {isCobrana && penPreview
                        ? formatPenAmount(penPreview.feePenCents)
                        : formatMoney(feePreview.feeCents / 100)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-2">
                    <span className="font-medium text-[var(--foreground)]">
                      Se cobra
                    </span>
                    <span className="text-base font-bold text-[var(--brand-primary,#ff781f)]">
                      {isCobrana && penPreview
                        ? formatPenAmount(penPreview.grossPenCents)
                        : formatMoney(feePreview.grossCents / 100)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-[var(--admin-text-muted,#64748b)]">
                    {isCobrana
                      ? `${fxSourceLabel} ${fxRate.toFixed(3)} · necesitás DNI en Hecom CRM.`
                      : "Ej.: querés $100 con fee 10% → se cobran $110."}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Método seleccionado
                </p>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <GatewayLogo gatewayId={selectedGateway} size="sm" />
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {gatewayLabels[selectedGateway]}
                  </p>
                </div>
                {isCobrana ? (
                  <>
                    <p className="mt-2 text-xs text-[var(--admin-text-muted,#64748b)]">
                      Abrís Yape u otra app bancaria con el código. El saldo USD
                      se acredita cuando se confirma el pago.
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {(
                        ["yape", "bcp", "plin", "interbank"] as const
                      ).map((app) => (
                        <PaymentAppIcon key={app} app={app} size="sm" />
                      ))}
                    </div>
                  </>
                ) : isVoucher ? (
                  <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
                    {selectedGateway === "crypto"
                      ? "Checkout solo USDT (TRC20). Si NOWPayments no está activo, enviás USDT y subís captura / TxID."
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
              {isCobrana
                ? "Se acredita el monto en USD; cobrás el equivalente en soles por Yape."
                : "Se acredita el monto pedido; Stripe cobra ese monto + fee Hecom."}
            </p>
            <dl className="mt-5 space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 text-sm">
              <div>
                <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Llega a cartera
                </dt>
                <dd className="text-lg font-bold text-[var(--brand-primary,#ff781f)]">
                  {formatMoney(parsedAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Fee ({formatFeePercentLabel(feePercent)})
                </dt>
                <dd className="font-medium text-[var(--foreground)]">
                  {isCobrana && penPreview
                    ? formatPenAmount(penPreview.feePenCents)
                    : feePreview
                      ? formatMoney(feePreview.feeCents / 100)
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                  Se cobra
                </dt>
                <dd className="text-lg font-bold text-[var(--foreground)]">
                  {isCobrana && penPreview
                    ? formatPenAmount(penPreview.grossPenCents)
                    : feePreview
                      ? formatMoney(feePreview.grossCents / 100)
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
                {loading
                  ? "Procesando…"
                  : isCobrana
                    ? "Generar código Yape"
                    : "Confirmar depósito"}
              </Button>
            </div>
          </>
        ) : step === "yape" ? (
          <>
            <div className="flex items-start gap-3">
              <PaymentAppIcon app="yape" size="lg" />
              <div className="min-w-0">
                <h2
                  id="add-balance-title"
                  className="text-lg font-semibold text-[var(--foreground)]"
                >
                  Pagá con Yape (PC o celular)
                </h2>
                <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
                  {resultMessage ??
                    "La mayoría paga desde la PC mirando el código y usando Yape en el celular."}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
              {cobranaCode ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]">
                    Código de pago
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <p className="font-mono text-2xl font-bold tracking-wide text-[var(--foreground)]">
                      {cobranaCode}
                    </p>
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)]"
                      onClick={() => {
                        void navigator.clipboard
                          ?.writeText(cobranaCode)
                          .then(() => {
                            setCodeCopied(true);
                            window.setTimeout(() => setCodeCopied(false), 2000);
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
              ) : null}
              {penPreview ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--admin-text-muted,#64748b)]">
                    Pagás en Yape
                  </span>
                  <span className="text-base font-bold tabular-nums text-[#5F0B72]">
                    {formatPenAmount(penPreview.grossPenCents)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--admin-text-muted,#64748b)]">
                  Llega a cartera
                </span>
                <span className="font-semibold text-[var(--foreground)]">
                  {formatMoney(parsedAmount)}
                </span>
              </div>
              <p className="text-[11px] text-[var(--admin-text-muted,#64748b)]">
                ID: <span className="font-mono">{paymentIntentId}</span>
              </p>
              <p className="text-xs font-medium text-[#5F0B72]">
                Esperando confirmación automática del pago…
              </p>
            </div>

            <ol className="mt-4 list-decimal space-y-2 rounded-xl border border-[#e9dff0] bg-[#faf6fc] px-4 py-3 pl-8 text-sm leading-5 text-[var(--foreground)]">
              <li>
                En el celular abrí <strong>Yape</strong>.
              </li>
              <li>
                Entrá a <strong>Pago de servicios</strong> (o “Servicios”).
              </li>
              <li>
                Buscá / ingresá el código{" "}
                <strong className="font-mono">
                  {cobranaCode ?? "HOL…"}
                </strong>
                .
              </li>
              <li>
                Confirmá el pago por{" "}
                <strong>
                  {penPreview
                    ? formatPenAmount(penPreview.grossPenCents)
                    : "el monto en soles"}
                </strong>
                .
              </li>
              <li>
                Volvé acá: al confirmarse, se acreditan{" "}
                <strong>{formatMoney(parsedAmount)}</strong> solos en tu
                cartera.
              </li>
            </ol>

            {orderedLinks.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                  Si estás en el celular, también podés abrir la app directo:
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
                          window.open(link.url, "_blank", "noopener,noreferrer");
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

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cerrar y esperar
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
                Llegan {formatMoney(parsedAmount)}
                {feePreview
                  ? ` · se cobran ${formatMoney(feePreview.grossCents / 100)}`
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
              {paidConfirmed ? "Pago acreditado" : "Intención registrada"}
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
