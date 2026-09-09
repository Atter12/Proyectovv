"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { formatStripeErrorForUser } from "@/lib/payments/stripe-messages";
import { GatewayLogo } from "./GatewayLogo";
import { PaymentAppIcon } from "./PaymentAppIcon";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detachLoading, setDetachLoading] = useState(false);
  const [reviewBusy, setReviewBusy] = useState<"approved" | "rejected" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodState>(null);
  const [cupo, setCupo] = useState<CupoState>(null);
  const [amountInput, setAmountInput] = useState("500");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<{
        ok: boolean;
        paymentMethod: PaymentMethodState;
        cupo: CupoState;
      }>("/api/billing/payment-method");
      setPaymentMethod(data.paymentMethod);
      setCupo(data.cupo);
      if (data.cupo?.requestedCreditUsd != null) {
        setAmountInput(String(Math.round(data.cupo.requestedCreditUsd)));
      }
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo cargar el crédito."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [load, visible]);

  useEffect(() => {
    if (!visible) return;
    const setup = searchParams.get("billing_setup");
    const sessionId = searchParams.get("session_id");
    if (setup !== "success" || !sessionId) return;

    void (async () => {
      try {
        await apiClient("/api/billing/complete-setup", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
        setSuccess("Tarjeta guardada. Tu crédito Holistic ya está activo.");
        router.replace("/payments");
        await load();
      } catch (err) {
        setError(userErrorMessage(err, "No se pudo confirmar la tarjeta."));
      }
    })();
  }, [searchParams, router, load, visible]);

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

  async function openStripe() {
    const data = await apiClient<{ checkoutUrl: string }>(
      "/api/billing/setup-session",
      { method: "POST", body: JSON.stringify({}) },
    );
    if (!data.checkoutUrl) throw new Error("Stripe no devolvió URL.");
    window.location.href = data.checkoutUrl;
  }

  /** Paso 1: solo pedir crédito (queda en revisión). */
  async function handleRequest() {
    const usd = Number(amountInput);
    if (!Number.isFinite(usd) || usd < 50) {
      setError("Elige un monto de al menos $50.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await saveCupo(usd);
      setSuccess(
        "Pedido enviado. Gerencia revisa y te avisa cuando puedas registrar la tarjeta.",
      );
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo enviar el pedido."));
    } finally {
      setBusy(false);
    }
  }

  /** Paso 3 (post-aprobación): registrar o actualizar tarjeta. */
  async function handleLinkCard() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await openStripe();
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo abrir Stripe."));
      setBusy(false);
    }
  }

  async function handleUpdateAmount() {
    const usd = Number(amountInput);
    if (!Number.isFinite(usd) || usd < 50) {
      setError("Elige un monto de al menos $50.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const next = await saveCupo(usd);
      if (approvalOf(next) === "requested") {
        setSuccess(
          "Monto actualizado. Vuelve a revisión de gerencia (si cambió el cupo).",
        );
      } else {
        setSuccess(`Cupo actualizado a ${formatMoney(usd, "USD")}.`);
      }
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo actualizar el cupo."));
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
          ? "Crédito aceptado. El cliente ya puede registrar la tarjeta Stripe."
          : "Pedido rechazado.",
      );
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo registrar la decisión."));
    } finally {
      setReviewBusy(null);
    }
  }

  async function handleDetach() {
    const ok = window.confirm(
      "¿Quitar esta tarjeta? Puedes volver a registrarla cuando quieras.",
    );
    if (!ok) return;

    setDetachLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient("/api/billing/payment-method", { method: "DELETE" });
      setSuccess("Tarjeta quitada.");
      await load();
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo quitar la tarjeta."));
    } finally {
      setDetachLoading(false);
    }
  }

  const brand = paymentMethod?.brand?.toUpperCase() ?? "CARD";
  const last4 = paymentMethod?.last4 ?? "••••";

  // Pasos visibles: 1 pedir · 2 gerencia · 3 tarjeta
  let step = 0;
  if (status === "requested") step = 1;
  else if (status === "approved" && !cupo?.lockReady) step = 2;
  else if (cupo?.lockReady) step = 3;
  else if (status === "rejected") step = 0;

  const stepLabels = [
    "1. Pedir",
    "2. Gerencia",
    "3. Tarjeta",
  ] as const;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white"
      aria-label={`Crédito Holistic para ${clienteName}`}
    >
      <header className="border-b border-[#eee8e2] bg-[#fffaf6] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <GatewayLogo gatewayId="stripe" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#1c1917]">
              Crédito Holistic
            </p>
            <p className="mt-0.5 text-[11px] text-[#6f675f]">
              Pedido → aceptación gerencia → tarjeta Stripe
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PaymentAppIcon app="visa" size="sm" />
            <PaymentAppIcon app="mastercard" size="sm" />
          </div>
        </div>

        <h2 className="mt-5 text-[1.4rem] font-semibold tracking-[-0.03em] text-[#171412]">
          ¿Quieres crédito Holistic?
        </h2>
        <p className="mt-1.5 max-w-[40rem] text-[13px] leading-5 text-[#625b54]">
          Primero pedís el monto. Gerencia acepta según tu historial. Recién
          después registrás la tarjeta (candado). Yape o BCP los usás luego para
          pagar el ciclo en soles.
        </p>

        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Pasos">
          {stepLabels.map((label, i) => (
            <li key={label}>
              <span
                className={cn(
                  "block h-1 rounded-full",
                  i <= Math.min(step, 2) ? "bg-[#ff781f]" : "bg-[#e5ddd5]",
                )}
              />
              <span
                className={cn(
                  "mt-1.5 block text-[10px] font-semibold",
                  i === Math.min(step, 2)
                    ? "text-[#1c1917]"
                    : "text-[#8a8177]",
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <div className="p-5 sm:p-6">
        {loading ? (
          <p className="text-[13px] text-[#6f675f]">Cargando…</p>
        ) : (
          <div className="space-y-4">
            {(status === "none" ||
              status === "rejected" ||
              status === "requested" ||
              status === "approved") && (
              <div>
                <p className="text-[13px] font-semibold text-[#1c1917]">
                  ¿Cuánto necesitas?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amount) => {
                    const selected = Number(amountInput) === amount;
                    return (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setAmountInput(String(amount))}
                        className={cn(
                          "h-10 rounded-xl border px-3.5 text-[13px] font-semibold tabular-nums transition-colors",
                          selected
                            ? "border-[#ff781f] bg-[#fff4eb] text-[#c65113]"
                            : "border-[#e7dfd7] bg-white text-[#1c1917] hover:border-[#ff781f]/50",
                        )}
                      >
                        ${amount}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 block">
                  <span className="text-[11px] font-medium text-[#6f675f]">
                    Otro monto (USD)
                  </span>
                  <Input
                    type="number"
                    min={50}
                    max={50000}
                    step={50}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="mt-1 h-11 rounded-xl border-[#ddd4cb] bg-[#f7f5f2] text-[1.05rem] font-semibold tabular-nums"
                  />
                </label>
              </div>
            )}

            {preview ? (
              <div className="overflow-hidden rounded-2xl bg-[#f7f5f2]">
                <div className="grid grid-cols-2 divide-x divide-[#e4ddd6] px-4 py-3.5 text-sm">
                  <div className="pr-3">
                    <p className="text-[10px] text-[#6f675f]">Vas a pedir</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-[#1c1917]">
                      {formatMoney(preview.requested, "USD")}
                    </p>
                  </div>
                  <div className="pl-3">
                    <p className="text-[10px] text-[#6f675f]">
                      Ideal en tu tarjeta
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-[#c65113]">
                      {formatMoney(preview.recommended, "USD")}+
                    </p>
                  </div>
                </div>
                <p className="border-t border-[#e4ddd6] px-4 py-2.5 text-[11px] leading-4 text-[#6f675f]">
                  Si pedís {formatMoney(preview.requested, "USD")}, conviene
                  tener al menos {formatMoney(preview.recommended, "USD")} en la
                  tarjeta (+{preview.headroom}%).
                </p>
              </div>
            ) : null}

            {status === "rejected" ? (
              <p className="rounded-xl bg-[#fff1f0] px-3.5 py-3 text-[12px] font-medium text-[#9b1c1c]">
                Este pedido fue rechazado. Podés enviar uno nuevo con otro monto.
              </p>
            ) : null}

            {status === "requested" ? (
              <div className="space-y-3">
                <p className="rounded-xl bg-[#fff8eb] px-3.5 py-3 text-[12px] font-medium text-[#8a5a12]">
                  Pedido en revisión
                  {cupo?.requestedCreditUsd != null
                    ? ` · ${formatMoney(cupo.requestedCreditUsd, "USD")}`
                    : ""}
                  . Todavía no registres tarjeta: espera la aceptación de
                  gerencia.
                </p>

                {canReviewCredit ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={reviewBusy != null}
                      onClick={() => void handleReview("approved")}
                      className="h-10 rounded-xl"
                    >
                      {reviewBusy === "approved"
                        ? "Aceptando…"
                        : "Aceptar crédito"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={reviewBusy != null}
                      onClick={() => void handleReview("rejected")}
                      className="h-10 rounded-xl"
                    >
                      {reviewBusy === "rejected" ? "…" : "Rechazar"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy || !preview}
                    onClick={() => void handleRequest()}
                    className="h-10 rounded-xl"
                  >
                    {busy ? "…" : "Actualizar monto del pedido"}
                  </Button>
                )}
              </div>
            ) : null}

            {(status === "none" || status === "rejected") && (
              <button
                type="button"
                disabled={busy || !preview}
                onClick={() => void handleRequest()}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Solicitar crédito Holistic"}
              </button>
            )}

            {status === "approved" ? (
              <div className="space-y-3">
                <p className="rounded-xl bg-[#f0faf4] px-3.5 py-3 text-[12px] font-medium text-[#0f6b3c]">
                  Gerencia aceptó tu crédito
                  {cupo?.requestedCreditUsd != null
                    ? ` de ${formatMoney(cupo.requestedCreditUsd, "USD")}`
                    : ""}
                  .
                  {cupo?.lockReady
                    ? " Ya está activo con tarjeta."
                    : " Ahora registrá tu tarjeta Stripe (candado)."}
                </p>

                {paymentMethod?.last4 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7dfd7] px-4 py-3.5">
                    <div>
                      <p className="text-[11px] text-[#6f675f]">
                        Tarjeta registrada
                      </p>
                      <p className="text-[14px] font-semibold text-[#1c1917]">
                        {brand} ···· {last4}
                        {paymentMethod.expMonth && paymentMethod.expYear
                          ? ` · ${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleUpdateAmount()}
                        className="h-10 rounded-xl"
                      >
                        {busy ? "…" : "Actualizar cupo"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={detachLoading}
                        onClick={() => void handleDetach()}
                        className="h-10 rounded-xl"
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                ) : canLinkCard ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLinkCard()}
                    className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Abriendo Stripe…" : "Registrar tarjeta Stripe"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {status === "none" ? (
              <p className="text-[12px] leading-5 text-[#6f675f]">
                Esto es crédito de Holistic (no confundir con la modalidad del
                CRM). Sin aceptación de gerencia no se activa ni se pide
                tarjeta.
              </p>
            ) : null}
          </div>
        )}

        {error ? (
          <p className="mt-3 text-[13px] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 text-[13px] text-emerald-800" role="status">
            {success}
          </p>
        ) : null}
      </div>
    </section>
  );
}
