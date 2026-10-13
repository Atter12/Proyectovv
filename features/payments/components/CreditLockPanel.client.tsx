"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { formatStripeErrorForUser } from "@/lib/payments/stripe-messages";

function userErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) {
    return formatStripeErrorForUser(err.message || fallback);
  }
  if (err instanceof Error) {
    return formatStripeErrorForUser(err.message || fallback);
  }
  return fallback;
}

type PaymentMethodState = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
} | null;

type ApprovalStatus = "none" | "requested" | "approved" | "rejected";

type CupoState = {
  approvalStatus?: ApprovalStatus;
  requestedCreditCents: number | null;
  requestedCreditUsd: number | null;
  cardHeadroomPercent: number;
  recommendedCardCents: number | null;
  recommendedCardUsd: number | null;
  softCapPercent: number;
  requireCard: boolean;
  hasCard: boolean;
  lockReady: boolean;
  canLinkCard?: boolean;
  requestedAt?: string | null;
  reviewedAt?: string | null;
} | null;

type AutochargeState = {
  failed: boolean;
  failedSince: string | null;
  frozen: boolean;
} | null;

interface CreditLockPanelProps {
  clienteName: string;
  /** Gerencia puede aceptar/rechazar (aunque esté “como cliente”). */
  canReviewCredit?: boolean;
  visible?: boolean;
}

const QUICK_AMOUNTS = [300, 500, 700, 1000] as const;

function approvalOf(cupo: CupoState): ApprovalStatus {
  return cupo?.approvalStatus ?? "none";
}

export function CreditLockPanel({
  clienteName,
  canReviewCredit = false,
  visible = true,
}: CreditLockPanelProps) {
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detachLoading, setDetachLoading] = useState(false);
  const [reviewBusy, setReviewBusy] = useState<"approved" | "rejected" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodState>(null);
  const [cupo, setCupo] = useState<CupoState>(null);
  const [autocharge, setAutocharge] = useState<AutochargeState>(null);
  const [consent, setConsent] = useState(false);
  const [amountInput, setAmountInput] = useState("500");
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<{
        ok: boolean;
        enabled?: boolean;
        paymentMethod: PaymentMethodState;
        cupo: CupoState;
        autocharge?: AutochargeState;
      }>("/api/billing/payment-method");
      setFeatureEnabled(data.enabled === true);
      setPaymentMethod(data.paymentMethod);
      setCupo(data.cupo);
      setAutocharge(data.autocharge ?? null);
      if (data.cupo?.requestedCreditUsd != null) {
        setAmountInput(String(Math.round(data.cupo.requestedCreditUsd)));
      }
      return data.paymentMethod;
    } catch (err) {
      setError(userErrorMessage(err, t("creditLock.errLoad")));
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [load, visible]);

  // Vuelta de Whop: se confirma con su setup_intent_id; si Whop aún procesa,
  // el webhook guarda la tarjeta y aquí se espera unos segundos.
  useEffect(() => {
    if (!visible) return;
    if (searchParams.get("billing_setup") !== "whop") return;
    const setupIntentId = searchParams.get("setup_intent_id") ?? searchParams.get("setup_intent");

    void (async () => {
      try {
        if (setupIntentId) {
          await apiClient("/api/billing/complete-setup", {
            method: "POST",
            body: JSON.stringify({ setupIntentId }),
          });
        }
        let saved = await load();
        for (let i = 0; i < 5 && !saved; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          saved = await load();
        }
        if (saved) setSuccess(t("creditLock.successCard"));
        else setSuccess(t("creditLock.cardPending"));
        router.replace("/payments");
      } catch (err) {
        setError(userErrorMessage(err, t("creditLock.errConfirmCard")));
      }
    })();
  }, [searchParams, router, load, visible, t]);

  const preview = useMemo(() => {
    const n = Number(amountInput);
    if (!Number.isFinite(n) || n <= 0) return null;
    const headroom = cupo?.cardHeadroomPercent ?? 15;
    const recommended = Math.ceil(n * (1 + headroom / 100));
    return { requested: n, recommended, headroom };
  }, [amountInput, cupo?.cardHeadroomPercent]);

  const status = approvalOf(cupo);
  const canLinkCard = Boolean(cupo?.canLinkCard ?? status === "approved");

  if (!visible) return null;
  if (!loading && !featureEnabled) return null;

  async function saveCupo(usd: number): Promise<CupoState> {
    const data = await apiClient<{ ok: boolean; cupo: CupoState }>(
      "/api/billing/payment-method",
      {
        method: "PUT",
        body: JSON.stringify({ requestedCreditUsd: usd }),
      },
    );
    setCupo(data.cupo);
    return data.cupo;
  }

  async function openWhop() {
    const data = await apiClient<{ checkoutUrl: string }>(
      "/api/billing/setup-session",
      { method: "POST", body: JSON.stringify({ consentAccepted: consent }) },
    );
    if (!data.checkoutUrl) throw new Error(t("creditLock.errStripeUrl"));
    window.location.href = data.checkoutUrl;
  }

  /** Paso 1: solo pedir crédito (queda en revisión). */
  async function handleRequest() {
    const usd = Number(amountInput);
    if (!Number.isFinite(usd) || usd < 50) {
      setError(t("creditLock.errMin50"));
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await saveCupo(usd);
      setSuccess(
        t("creditLock.successRequested"),
      );
    } catch (err) {
      setError(userErrorMessage(err, t("creditLock.errRequest")));
    } finally {
      setBusy(false);
    }
  }

  /** Paso 3 (post-aprobación): registrar o actualizar tarjeta. */
  async function handleLinkCard() {
    if (!consent) {
      setError(t("creditLock.errConsent"));
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await openWhop();
    } catch (err) {
      setError(userErrorMessage(err, t("creditLock.errOpenStripe")));
      setBusy(false);
    }
  }

  async function handleUpdateAmount() {
    const usd = Number(amountInput);
    if (!Number.isFinite(usd) || usd < 50) {
      setError(t("creditLock.errMin50"));
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await saveCupo(usd);
      if (approvalOf(next) === "requested") {
        setSuccess(
          t("creditLock.successAmountUpdated"),
        );
      } else {
        setSuccess(t("creditLock.successCupoUpdated", { amount: formatMoney(usd, "USD") }));
      }
    } catch (err) {
      setError(userErrorMessage(err, t("creditLock.errUpdateCupo")));
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(decision: "approved" | "rejected") {
    setReviewBusy(decision);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiClient<{ ok: boolean; cupo: CupoState }>(
        "/api/billing/credit-lock/review",
        {
          method: "POST",
          body: JSON.stringify({ decision }),
        },
      );
      setCupo(data.cupo);
      setSuccess(
        decision === "approved"
          ? t("creditLock.successApproved")
          : t("creditLock.successRejected"),
      );
    } catch (err) {
      setError(userErrorMessage(err, t("creditLock.errReview")));
    } finally {
      setReviewBusy(null);
    }
  }

  async function handleDetach() {
    const ok = window.confirm(
      t("creditLock.confirmDetach"),
    );
    if (!ok) return;

    setDetachLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient("/api/billing/payment-method", { method: "DELETE" });
      setSuccess(t("creditLock.successDetached"));
      await load();
    } catch (err) {
      setError(userErrorMessage(err, t("creditLock.errDetach")));
    } finally {
      setDetachLoading(false);
    }
  }

  const brand = paymentMethod?.brand?.toUpperCase() ?? "CARD";
  const last4 = paymentMethod?.last4 ?? "••••";
  const cardExpiry =
    paymentMethod?.expMonth && paymentMethod.expYear
      ? `${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`
      : null;

  // Pasos: 0 pedir · 1 gerencia · 2 tarjeta · 3 todo listo
  let step = 0;
  if (status === "requested") step = 1;
  else if (status === "approved" && !cupo?.lockReady) step = 2;
  else if (cupo?.lockReady) step = 3;

  const stepLabels = [
    t("creditLock.step1"),
    t("creditLock.step2"),
    t("creditLock.step3"),
  ] as const;

  const messages = (
    <>
      {error ? (
        <p className="mt-4 border-l-2 border-[#b42318] pl-3 text-[13px] text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 border-l-2 border-[#067647] pl-3 text-[13px] text-[#067647]" role="status">
          {success}
        </p>
      ) : null}
    </>
  );

  // Vista gerente: solo revisar el pedido del cliente, sin el formulario.
  if (canReviewCredit) {
    if (loading || status === "none") return null;
    const amount =
      cupo?.requestedCreditUsd != null
        ? formatMoney(cupo.requestedCreditUsd, "USD")
        : "—";
    return (
      <section
        className="rounded-xl border border-[#e4e7ec] bg-white px-5 py-4 sm:px-6"
        aria-label={t("creditLock.aria", { name: clienteName })}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <CardGlyph />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#667085]">
              {t("creditLock.reviewEyebrow")}
            </p>
            <p className="mt-1 text-[15px] font-semibold text-[#101828]">
              {status === "requested"
                ? t("creditLock.reviewRequested", { name: clienteName, amount })
                : status === "approved"
                  ? t("creditLock.reviewApproved", { amount })
                  : t("creditLock.reviewRejected", { amount })}
            </p>
            {status === "approved" ? (
              <p className="mt-0.5 text-[13px] text-[#475467]">
                {paymentMethod
                  ? t("creditLock.reviewCard", { card: `${brand} •••• ${last4}` })
                  : t("creditLock.reviewNoCard")}
              </p>
            ) : null}
            {autocharge?.failed ? (
              <p className="mt-1 text-[13px] text-[#b42318]" role="alert">
                {autocharge.frozen ? t("creditLock.autochargeFrozen") : t("creditLock.autochargeFailed")}
              </p>
            ) : null}
          </div>
          {status === "requested" ? (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={reviewBusy != null}
                onClick={() => void handleReview("rejected")}
                className={SECONDARY_BUTTON}
              >
                {reviewBusy === "rejected" ? "…" : t("creditLock.reject")}
              </button>
              <button
                type="button"
                disabled={reviewBusy != null}
                onClick={() => void handleReview("approved")}
                className={PRIMARY_BUTTON}
              >
                {reviewBusy === "approved"
                  ? t("creditLock.accepting")
                  : t("creditLock.accept")}
              </button>
            </div>
          ) : null}
        </div>
        {messages}
      </section>
    );
  }

  // Sin pedido en curso el crédito es una opción, no una tarea: se muestra
  // como una fila que se abre. Con pedido en curso hay estado que el cliente
  // necesita ver sin buscarlo, así que queda abierto.
  const idle = !loading && (status === "none" || status === "rejected");
  if (idle && !expanded) {
    return (
      <section
        className="rounded-xl border border-[#e4e7ec] bg-white px-5 py-5 sm:px-6"
        aria-label={t("creditLock.aria", { name: clienteName })}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <CardGlyph />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-[#101828]">
              {t("creditLock.idleTitle")}
            </p>
            <p className="mt-1 max-w-[40rem] text-[13px] leading-5 text-[#475467]">
              {t("creditLock.idleBody")}
              {status === "rejected" ? t("creditLock.idleRejected") : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={cn(PRIMARY_BUTTON, "shrink-0")}
          >
            {t("creditLock.askCta")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-[#e4e7ec] bg-white"
      aria-label={t("creditLock.aria", { name: clienteName })}
    >
      <header className="px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-4">
          <CardGlyph />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#667085]">
              {t("creditLock.title")}
            </p>
            <h2 className="mt-1 text-[1.2rem] font-semibold tracking-[-0.01em] text-[#101828]">
              {t("creditLock.heading")}
            </h2>
            <p className="mt-1 max-w-[42rem] text-[13px] leading-5 text-[#475467]">
              {t("creditLock.intro")}
            </p>
          </div>
          {idle ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={t("creditLock.closeAria")}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-[#f2f4f7] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101828]/20 sm:h-8 sm:w-8"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
              </svg>
            </button>
          ) : null}
        </div>

        <ol className="mt-6 flex items-center" aria-label={t("creditLock.stepsAria")}>
          {stepLabels.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} className={cn("flex items-center", i < stepLabels.length - 1 && "flex-1")}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                      done
                        ? "bg-[#101828] text-white"
                        : current
                          ? "border border-[#101828] text-[#101828]"
                          : "border border-[#d0d5dd] text-[#98a2b3]",
                    )}
                    aria-current={current ? "step" : undefined}
                  >
                    {done ? (
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "hidden text-[12px] sm:inline",
                      done || current ? "font-medium text-[#101828]" : "text-[#98a2b3]",
                    )}
                  >
                    {label.replace(/^\d+\.\s*/, "")}
                  </span>
                </span>
                {i < stepLabels.length - 1 ? (
                  <span className={cn("mx-3 h-px flex-1", done ? "bg-[#101828]" : "bg-[#e4e7ec]")} aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </header>

      <div className="mt-5 border-t border-[#eaecf0] px-5 py-5 sm:px-7 sm:py-6">
        {loading ? (
          <p className="text-[13px] text-[#667085]">{tCommon("loading")}</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[13px] font-medium text-[#344054]">
                {t("creditLock.howMuch")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUICK_AMOUNTS.map((amount) => {
                  const selected = Number(amountInput) === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setAmountInput(String(amount))}
                      aria-pressed={selected}
                      className={cn(
                        "h-11 rounded-lg border text-[14px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101828]/20",
                        selected
                          ? "border-[#101828] bg-[#f9fafb] text-[#101828]"
                          : "border-[#d0d5dd] bg-white text-[#344054] hover:border-[#98a2b3]",
                      )}
                    >
                      {formatMoney(amount, "USD")}
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 block">
                <span className="text-[12px] text-[#667085]">
                  {t("creditLock.otherAmount")}
                </span>
                <Input
                  type="number"
                  min={50}
                  max={50000}
                  step={50}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="mt-1 h-11 rounded-lg border-[#d0d5dd] bg-white text-[15px] font-medium tabular-nums"
                />
              </label>
            </div>

            {preview ? (
              <dl className="divide-y divide-[#eaecf0] rounded-lg border border-[#eaecf0] text-[13px]">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-[#475467]">{t("creditLock.willAsk")}</dt>
                  <dd className="font-semibold tabular-nums text-[#101828]">
                    {formatMoney(preview.requested, "USD")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-[#475467]">{t("creditLock.idealCard")}</dt>
                  <dd className="font-semibold tabular-nums text-[#101828]">
                    {formatMoney(preview.recommended, "USD")}
                  </dd>
                </div>
                <p className="bg-[#f9fafb] px-4 py-2.5 text-[12px] leading-4 text-[#667085]">
                  {t("creditLock.previewHint", {
                    requested: formatMoney(preview.requested, "USD"),
                    recommended: formatMoney(preview.recommended, "USD"),
                    headroom: preview.headroom,
                  })}
                </p>
              </dl>
            ) : null}

            {status === "rejected" ? (
              <Notice tone="danger">{t("creditLock.rejectedBanner")}</Notice>
            ) : null}

            {status === "requested" ? (
              <div className="space-y-3">
                <Notice tone="pending">
                  {t("creditLock.inReview")}
                  {cupo?.requestedCreditUsd != null
                    ? ` · ${formatMoney(cupo.requestedCreditUsd, "USD")}`
                    : ""}
                  {t("creditLock.inReviewWait")}
                </Notice>
                <button
                  type="button"
                  disabled={busy || !preview}
                  onClick={() => void handleRequest()}
                  className={SECONDARY_BUTTON}
                >
                  {busy ? "…" : t("creditLock.updateRequest")}
                </button>
              </div>
            ) : null}

            {(status === "none" || status === "rejected") && (
              <button
                type="button"
                disabled={busy || !preview}
                onClick={() => void handleRequest()}
                className={cn(PRIMARY_BUTTON, "h-12 w-full text-[15px]")}
              >
                {busy ? t("creditLock.sending") : t("creditLock.requestCta")}
              </button>
            )}

            {status === "approved" ? (
              <div className="space-y-4">
                <Notice tone="success">
                  {t("creditLock.approvedBanner")}
                  {cupo?.requestedCreditUsd != null
                    ? t("creditLock.approvedOf", { amount: formatMoney(cupo.requestedCreditUsd, "USD") })
                    : ""}
                  .
                  {cupo?.lockReady
                    ? t("creditLock.approvedActive")
                    : t("creditLock.approvedLink")}
                </Notice>

                {autocharge?.failed ? (
                  <Notice tone="danger" alert>
                    {autocharge.frozen ? t("creditLock.autochargeFrozen") : t("creditLock.autochargeFailed")}
                  </Notice>
                ) : null}

                {paymentMethod ? (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#eaecf0] px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-12 items-center justify-center rounded-md border border-[#eaecf0] bg-[#f9fafb] text-[10px] font-bold tracking-[0.04em] text-[#344054]">
                        {brand}
                      </span>
                      <div>
                        <p className="text-[14px] font-medium tabular-nums text-[#101828]">
                          •••• {last4}
                        </p>
                        <p className="text-[12px] text-[#667085]">
                          {t("creditLock.cardRegistered")}
                          {cardExpiry ? ` · ${cardExpiry}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleUpdateAmount()}
                        className={SECONDARY_BUTTON}
                      >
                        {busy ? "…" : t("creditLock.updateCupo")}
                      </button>
                      <button
                        type="button"
                        disabled={detachLoading}
                        onClick={() => void handleDetach()}
                        className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-[#475467] transition-colors hover:bg-[#f2f4f7] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101828]/20 disabled:opacity-50"
                      >
                        {t("creditLock.remove")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {canLinkCard && (!paymentMethod || autocharge?.failed) ? (
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#eaecf0] bg-[#f9fafb] px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#101828]"
                      />
                      <span className="text-[12px] leading-5 text-[#344054]">
                        {t("creditLock.consent")}
                      </span>
                    </label>
                    <button
                      type="button"
                      disabled={busy || !consent}
                      onClick={() => void handleLinkCard()}
                      className={cn(PRIMARY_BUTTON, "h-12 w-full text-[15px]")}
                    >
                      {busy
                        ? t("creditLock.openingStripe")
                        : paymentMethod
                          ? t("creditLock.changeCard")
                          : t("creditLock.registerCard")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="flex items-center gap-1.5 text-[12px] leading-5 text-[#667085]">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="7" width="10" height="7" rx="1.5" />
                <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
              </svg>
              {status === "none" ? t("creditLock.footnote") : t("creditLock.secureNote")}
            </p>
          </div>
        )}

        {messages}
      </div>
    </section>
  );
}

const PRIMARY_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-lg bg-[#101828] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d2939] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101828]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

const SECONDARY_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-lg border border-[#d0d5dd] bg-white px-4 text-[13px] font-semibold text-[#344054] transition-colors hover:bg-[#f9fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101828]/20 disabled:cursor-not-allowed disabled:opacity-50";

function CardGlyph() {
  return (
    <span
      aria-hidden
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#eaecf0] bg-[#f9fafb] text-[#344054]"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </svg>
    </span>
  );
}

const NOTICE_TONE = {
  success: "border-[#067647] text-[#054f31]",
  pending: "border-[#b54708] text-[#7a2e0e]",
  danger: "border-[#b42318] text-[#7a271a]",
} as const;

function Notice({
  tone,
  alert = false,
  children,
}: {
  tone: keyof typeof NOTICE_TONE;
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      role={alert ? "alert" : undefined}
      className={cn(
        "rounded-r-lg border-l-2 bg-[#f9fafb] px-4 py-3 text-[13px] leading-5",
        NOTICE_TONE[tone],
      )}
    >
      {children}
    </p>
  );
}
