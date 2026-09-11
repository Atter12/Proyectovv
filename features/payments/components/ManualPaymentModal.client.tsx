"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import {
  depositFromDesiredCredit,
  formatFeePercentLabel,
} from "@/lib/payments/deposit-fee";
import { formatPenAmount } from "@/lib/payments/manual-deposit.shared";
import { GatewayLogo } from "./GatewayLogo";
import { PaymentAppIcon, resolvePaymentAppKey } from "./PaymentAppIcon";
import {
  CheckCircleIcon,
  ClockIcon,
  PaymentModalFooter,
  PaymentModalHeader,
} from "./PaymentModalChrome";

type ChargeCurrency = "USD" | "PEN";
type Step =
  "form" | "banks" | "voucher" | "analyzing" | "confirmed" | "pending";

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
  fxSource?: string;
  fxAsOf?: string | null;
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
const subscribeToNothing = () => () => {};

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
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const { formatMoney } = useAppFormatter();
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const manualSteps = useMemo(
    () =>
      [
        t("manualModal.stepAmount"),
        t("manualModal.stepTransfer"),
        t("manualModal.stepProof"),
      ] as const,
    [t],
  );
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
  const fxLabel = useMemo(() => {
    const src = (config?.fxSource ?? "").toLowerCase();
    if (src === "sbs") {
      return config?.fxAsOf
        ? t("addBalance.fxSbsAsOf", { date: config.fxAsOf })
        : t("addBalance.fxSbs");
    }
    return t("addBalance.fxReferential");
  }, [config?.fxAsOf, config?.fxSource, t]);
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
        : tCommon("emDash");
  const modalStepIndex = step === "form" ? 0 : step === "banks" ? 1 : 2;

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
      setError(t("manualModal.errFileType"));
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
      setError(
        t("manualModal.errAmountRange", {
          min: formatMoney(MIN_USD),
          max: formatMoney(MAX_USD),
        }),
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<CreateIntentResponse>(
        "/api/payments/intents",
        {
          method: "POST",
          body: JSON.stringify({
            amount: parsedAmount,
            provider: "manual",
            chargeCurrency,
          }),
        },
      );
      setPaymentIntentId(data.paymentIntent.paymentIntentId);
      setStep("banks");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("manualModal.errCreate"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitVoucher() {
    if (!paymentIntentId || !proofFile) {
      setError(t("manualModal.errNeedProof"));
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
            t("manualModal.pendingToast"),
        );
        setStep("pending");
      }
    } catch (err) {
      setStep("voucher");
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("manualModal.errProcess"),
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/55 backdrop-blur-[2px]"
        aria-label={tCommon("close")}
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-payment-title"
        className="scrollbar-thin relative max-h-[min(92vh,calc(100dvh-1.5rem))] w-full max-w-[36rem] overflow-y-auto rounded-[1.25rem] bg-white shadow-[0_28px_90px_rgb(15_23_42_/_0.24)]"
      >
        {step === "form" ? (
          <>
            <PaymentModalHeader
              titleId="manual-payment-title"
              title={t("manualModal.amountTitle")}
              description={t("manualModal.amountHint")}
              identityIcon={<GatewayLogo gatewayId="manual" size="sm" />}
              identityLabel={t("manualModal.title")}
              identityDescription={t("manualModal.subtitle")}
              steps={manualSteps}
              currentStep={modalStepIndex}
              onClose={resetAndClose}
            />
            <div className="p-5 sm:p-6">
              <div>
                <label className="mb-2 block text-[12px] font-semibold text-[#514b45]">
                  {t("manualModal.receiveLabel")}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-[#8a8177]">
                    $
                  </span>
                  <Input
                    type="number"
                    min={MIN_USD}
                    max={MAX_USD}
                    step="0.01"
                    placeholder="120.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                    className="h-14 rounded-xl pl-9 text-lg font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-[12px] font-semibold text-[#514b45]">
                  {t("manualModal.currency")}
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
                      {c === "PEN"
                        ? t("manualModal.pen")
                        : t("manualModal.usd")}
                    </button>
                  ))}
                </div>
              </div>

              {quote ? (
                <div className="mt-5 rounded-2xl bg-[#f7f5f2] p-4 text-sm sm:p-5">
                  <p className="mb-3 text-[13px] font-semibold text-[#1c1917]">
                    {t("manualModal.transferSummary")}
                  </p>
                  <div className="flex justify-between">
                    <span className="text-[#625b54]">
                      {t("manualModal.receiveWallet")}
                    </span>
                    <span className="font-semibold tabular-nums text-[#1c1917]">
                      {formatMoney(quote.usd.creditCents / 100)}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-[#625b54]">
                      Fee {formatFeePercentLabel(feePercent)}
                    </span>
                    <span className="font-medium tabular-nums text-[#1c1917]">
                      {chargeCurrency === "PEN"
                        ? formatPenAmount(quote.pen.feePenCents)
                        : formatMoney(quote.usd.feeCents / 100)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-[#e4ddd6] pt-3">
                    <span className="font-semibold text-[#1c1917]">
                      {t("manualModal.totalTransfer")}
                    </span>
                    <span className="text-xl font-semibold tracking-[-0.02em] tabular-nums text-[#e85a1c]">
                      {chargeLabel}
                    </span>
                  </div>
                  {chargeCurrency === "PEN" ? (
                    <p className="mt-3 text-[11px] leading-4 text-[#6f675f]">
                      {t("manualModal.fxFixed", {
                        label: fxLabel,
                        rate: rate.toFixed(4),
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <p className="mt-3 text-xs text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <PaymentModalFooter>
                <Button
                  variant="outline"
                  onClick={resetAndClose}
                  className="h-11 w-full rounded-xl sm:w-auto"
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleCreateIntent}
                  disabled={!isValidAmount || loading}
                  className="h-11 w-full rounded-xl bg-[#ff781f] px-6 hover:bg-[#e85a1c] sm:w-auto"
                >
                  {loading ? t("addBalance.processing") : t("manualModal.seeBanks")}
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : null}

        {step === "banks" ? (
          <>
            <PaymentModalHeader
              titleId="manual-payment-title"
              title={t("manualModal.doTransfer")}
              description={t("manualModal.transferHint", { amount: chargeLabel })}
              identityIcon={<GatewayLogo gatewayId="manual" size="sm" />}
              identityLabel={t("manualModal.title")}
              identityDescription={t("manualModal.subtitle")}
              steps={manualSteps}
              currentStep={modalStepIndex}
              onClose={resetAndClose}
            />
            <div className="p-5 sm:p-6">
              <div className="space-y-3">
                {banks.length === 0 ? (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
                    Las cuentas bancarias están pendientes de configuración.
                    Contacta con soporte.
                  </p>
                ) : (
                  banks.map((bank) => {
                    const bankApp = resolvePaymentAppKey(bank.bank, bank.label);
                    return (
                      <div
                        key={bank.id}
                        className="rounded-2xl bg-[#f7f5f2] p-4 sm:p-5"
                      >
                        <div className="flex items-center gap-3">
                          <PaymentAppIcon app={bankApp} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#1c1917]">
                              {bank.label}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-[#6f675f]">
                              {bank.holder}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#e4ddd6] pt-3">
                          <div className="min-w-0">
                            <p className="text-[10px] text-[#6f675f]">
                              {t("manualModal.accountNumber")}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-[#1c1917]">
                              {bank.accountNumber}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void copyText(bank.accountNumber)}
                            className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#ddd4cb] bg-white px-3 text-xs font-semibold text-[#c65113] transition-colors hover:bg-[#fff8f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/35"
                          >
                            {t("addBalance.copy")}
                          </button>
                        </div>
                        {bank.cci ? (
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] text-[#6f675f]">CCI</p>
                              <p className="mt-0.5 truncate font-mono text-[12px] font-medium text-[#1c1917]">
                                {bank.cci}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void copyText(bank.cci!)}
                              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#ddd4cb] bg-white px-3 text-xs font-semibold text-[#c65113] transition-colors hover:bg-[#fff8f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/35"
                            >
                              {t("addBalance.copy")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <PaymentModalFooter>
                <Button
                  variant="outline"
                  onClick={() => setStep("form")}
                  className="h-11 w-full rounded-xl sm:w-auto"
                >
                  {tCommon("back")}
                </Button>
                <Button
                  className="h-11 w-full rounded-xl bg-[#ff781f] px-6 hover:bg-[#e85a1c] sm:w-auto"
                  onClick={() => setStep("voucher")}
                >
                  {t("manualModal.paidUpload")}
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : null}

        {step === "voucher" ? (
          <>
            <PaymentModalHeader
              titleId="manual-payment-title"
              title={t("manualModal.uploadTitle")}
              description={t("manualModal.uploadDesc")}
              identityIcon={<GatewayLogo gatewayId="manual" size="sm" />}
              identityLabel={t("manualModal.title")}
              identityDescription={t("manualModal.subtitle")}
              steps={manualSteps}
              currentStep={modalStepIndex}
              onClose={resetAndClose}
            />
            <div
              ref={pasteZoneRef}
              tabIndex={0}
              className="p-5 outline-none sm:p-6"
            >
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
                    alt={t("manualModal.previewAlt")}
                    className="max-h-32 rounded-lg object-contain"
                  />
                ) : proofFile ? (
                  <p className="text-sm font-medium text-emerald-800">
                    {proofFile.name}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[#1c1917]">
                      {t("manualModal.uploadHint")}
                    </p>
                    <p className="mt-1 text-xs text-[#8a8177]">
                      {t("manualModal.fileTypesHint")}
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
                  {t("manualModal.gallery")}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => pasteZoneRef.current?.focus()}
                >
                  {t("manualModal.paste")}
                </Button>
              </div>

              {error ? (
                <p className="mt-3 text-xs text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <PaymentModalFooter>
                <Button
                  variant="outline"
                  onClick={() => setStep("banks")}
                  className="h-11 w-full rounded-xl sm:w-auto"
                >
                  {tCommon("back")}
                </Button>
                <Button
                  disabled={!proofFile}
                  className="h-11 w-full rounded-xl bg-[#ff781f] px-6 hover:bg-[#e85a1c] sm:w-auto"
                  onClick={handleSubmitVoucher}
                >
                  {t("manualModal.verify")}
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : null}

        {step === "analyzing" ? (
          <>
            <PaymentModalHeader
              titleId="manual-payment-title"
              title={t("manualModal.verifying")}
              description={t("manualModal.verifyingDesc")}
              identityIcon={<GatewayLogo gatewayId="manual" size="sm" />}
              identityLabel={t("manualModal.title")}
              identityDescription={t("manualModal.subtitle")}
              steps={manualSteps}
              currentStep={modalStepIndex}
              onClose={resetAndClose}
            />
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ff781f]/20 border-t-[#ff781f]" />
              <p className="mt-5 text-[13px] font-medium text-[#625b54]">
                {t("manualModal.analyzingWait")}
              </p>
            </div>
          </>
        ) : null}

        {step === "confirmed" ? (
          <>
            <PaymentModalHeader
              titleId="manual-payment-title"
              title={t("manualModal.confirmed")}
              description={t("manualModal.confirmedDesc")}
              identityIcon={<GatewayLogo gatewayId="manual" size="sm" />}
              identityLabel={t("manualModal.title")}
              identityDescription={t("manualModal.subtitle")}
              steps={manualSteps}
              currentStep={modalStepIndex}
              onClose={resetAndClose}
            />
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircleIcon />
                </span>
                <div>
                  <p className="text-[11px] font-medium text-emerald-700">
                    {t("manualModal.credited")}
                  </p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-[#1c1917]">
                    {formatMoney(creditResult ?? parsedAmount)}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-800">
                    {t("manualModal.canAssign")}
                  </p>
                </div>
              </div>
              <PaymentModalFooter>
                <Button
                  className="h-11 w-full rounded-xl bg-[#ff781f] px-6 hover:bg-[#e85a1c] sm:w-auto"
                  onClick={resetAndClose}
                >
                  {t("manualModal.done")}
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : null}

        {step === "pending" ? (
          <>
            <PaymentModalHeader
              titleId="manual-payment-title"
              title={t("manualModal.pendingTitle")}
              description={t("manualModal.pendingDesc")}
              identityIcon={<GatewayLogo gatewayId="manual" size="sm" />}
              identityLabel={t("manualModal.title")}
              identityDescription={t("manualModal.subtitle")}
              steps={manualSteps}
              currentStep={modalStepIndex}
              onClose={resetAndClose}
            />
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4 rounded-2xl bg-amber-50 p-4 text-amber-900">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <ClockIcon />
                </span>
                <p className="pt-1 text-[13px] leading-5">{pendingMessage}</p>
              </div>
              <PaymentModalFooter>
                <Button
                  className="h-11 w-full rounded-xl bg-[#ff781f] px-6 hover:bg-[#e85a1c] sm:w-auto"
                  onClick={resetAndClose}
                >
                  {t("manualModal.understood")}
                </Button>
              </PaymentModalFooter>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
