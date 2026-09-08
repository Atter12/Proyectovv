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

type CupoState = {
  requestedCreditCents: number | null;
  requestedCreditUsd: number | null;
  cardHeadroomPercent: number;
  recommendedCardCents: number | null;
  recommendedCardUsd: number | null;
  softCapPercent: number;
  requireCard: boolean;
  hasCard: boolean;
  lockReady: boolean;
} | null;

interface CreditLockPanelProps {
  clienteName: string;
  visible?: boolean;
}

const STEPS = ["Monto", "Tarjeta", "Listo"] as const;

export function CreditLockPanel({
  clienteName,
  visible = true,
}: CreditLockPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [detachLoading, setDetachLoading] = useState(false);
  const [savingCupo, setSavingCupo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodState>(null);
  const [cupo, setCupo] = useState<CupoState>(null);
  const [amountInput, setAmountInput] = useState("700");

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
        setSuccess("¡Listo! Tu crédito ya quedó habilitado con Stripe.");
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

  const currentStep = cupo?.lockReady
    ? 2
    : cupo?.requestedCreditCents
      ? 1
      : 0;

  if (!visible) return null;

  async function handleSaveCupo() {
    setSavingCupo(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiClient<{ ok: boolean; cupo: CupoState }>(
        "/api/billing/payment-method",
        {
          method: "PUT",
          body: JSON.stringify({
            requestedCreditUsd: Number(amountInput),
          }),
        },
      );
      setCupo(data.cupo);
      setSuccess(
        `Perfecto. Pediste ${formatMoney(Number(amountInput), "USD")}. Siguiente: vinculá tu tarjeta Stripe.`,
      );
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo guardar el monto."));
    } finally {
      setSavingCupo(false);
    }
  }

  async function handleSaveCard() {
    if (!cupo?.requestedCreditCents) {
      setError("Primero elegí cuánto crédito querés y guardá el monto.");
      return;
    }
    setCardLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiClient<{ checkoutUrl: string }>(
        "/api/billing/setup-session",
        { method: "POST", body: JSON.stringify({}) },
      );
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error("Stripe no devolvió URL.");
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo abrir Stripe."));
      setCardLoading(false);
    }
  }

  async function handleDetach() {
    const ok = window.confirm(
      "¿Quitar esta tarjeta de tu cuenta? Podés volver a vincular otra cuando quieras.",
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

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white"
      aria-label={`Crédito para ${clienteName}`}
    >
      <header className="border-b border-[#eee8e2] bg-[#fffaf6] px-5 pb-5 pt-5 sm:px-6">
        <div className="flex items-center gap-3">
          <GatewayLogo gatewayId="stripe" size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#1c1917]">
              Crédito Holistic
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#6f675f]">
              Solo con tarjeta Stripe · Visa / Mastercard
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <PaymentAppIcon app="visa" size="sm" />
            <PaymentAppIcon app="mastercard" size="sm" />
          </div>
        </div>

        <div className="mt-5 max-w-[38rem]">
          <h2 className="text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-[#171412]">
            ¿Deseas tener crédito?
          </h2>
          <p className="mt-1.5 max-w-[62ch] text-[13px] leading-5 text-[#625b54]">
            Gastá primero, pagá el ciclo después. Para activarlo solo necesitás
            una tarjeta Stripe — Yape y BCP siguen para abonar en soles cuando
            toque cobranza.
          </p>
        </div>

        <ol
          className="mt-5 grid grid-cols-3 gap-2"
          aria-label="Progreso del crédito"
        >
          {STEPS.map((step, index) => {
            const reached = index <= currentStep;
            const current = index === currentStep;
            return (
              <li key={step} aria-current={current ? "step" : undefined}>
                <span
                  className={cn(
                    "block h-1 rounded-full transition-colors",
                    reached ? "bg-[#ff781f]" : "bg-[#e5ddd5]",
                  )}
                />
                <span
                  className={cn(
                    "mt-1.5 block text-[10px] font-semibold",
                    current
                      ? "text-[#1c1917]"
                      : reached
                        ? "text-[#c65113]"
                        : "text-[#8a8177]",
                  )}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="p-5 sm:p-6">
        {loading ? (
          <p className="text-[13px] text-[#6f675f]">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl bg-[#f7f5f2]">
              <div className="border-b border-[#e4ddd6] px-4 py-4 sm:px-5">
                <p className="text-[11px] font-medium text-[#6f675f]">
                  ¿Cuánto crédito querés?
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <label className="block min-w-[9rem] flex-1 space-y-1">
                    <span className="sr-only">Monto USD</span>
                    <Input
                      type="number"
                      min={50}
                      max={50000}
                      step={50}
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="700"
                      className="h-11 rounded-xl border-[#ddd4cb] bg-white text-[1.1rem] font-semibold tabular-nums"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={savingCupo}
                    onClick={() => void handleSaveCupo()}
                    className="h-11 rounded-xl px-4"
                  >
                    {savingCupo ? "Guardando…" : "Guardar monto"}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[#6f675f]">
                  Ejemplos: 300 · 500 · 700 · 1000 USD. El equipo confirma según
                  historial.
                </p>
              </div>

              <div className="grid grid-cols-2 divide-x divide-[#e4ddd6] px-4 py-4 text-sm sm:px-5">
                <div className="pr-4">
                  <p className="text-[10px] text-[#6f675f]">Cupo pedido</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-[#1c1917]">
                    {preview
                      ? formatMoney(preview.requested, "USD")
                      : cupo?.requestedCreditUsd != null
                        ? formatMoney(cupo.requestedCreditUsd, "USD")
                        : "—"}
                  </p>
                </div>
                <div className="pl-4">
                  <p className="text-[10px] text-[#6f675f]">
                    Conviene en tarjeta
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-[#c65113]">
                    {preview
                      ? `${formatMoney(preview.recommended, "USD")}+`
                      : cupo?.recommendedCardUsd != null
                        ? `${formatMoney(cupo.recommendedCardUsd, "USD")}+`
                        : "—"}
                  </p>
                </div>
              </div>
            </div>

            {preview ? (
              <p className="text-[12px] leading-5 text-[#625b54]">
                Si pedís{" "}
                <strong className="text-[#1c1917]">
                  {formatMoney(preview.requested, "USD")}
                </strong>
                , en la tarjeta conviene tener al menos{" "}
                <strong className="text-[#1c1917]">
                  {formatMoney(preview.recommended, "USD")}
                </strong>{" "}
                (+{preview.headroom}% de margen).
              </p>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-[#e7dfd7] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[#6f675f]">
                    Candado Stripe
                  </p>
                  {paymentMethod?.last4 ? (
                    <p className="mt-0.5 text-[15px] font-semibold text-[#1c1917]">
                      {brand} ···· {last4}
                      {paymentMethod.expMonth && paymentMethod.expYear
                        ? ` · ${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`
                        : ""}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[15px] font-semibold text-[#1c1917]">
                      Todavía no hay tarjeta
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {paymentMethod?.last4 ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={cardLoading}
                        onClick={() => void handleSaveCard()}
                        className="h-10 rounded-xl"
                      >
                        {cardLoading ? "Abriendo…" : "Cambiar"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={detachLoading}
                        onClick={() => void handleDetach()}
                        className="h-10 rounded-xl"
                      >
                        {detachLoading ? "…" : "Quitar"}
                      </Button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={cardLoading || !cupo?.requestedCreditCents}
                      onClick={() => void handleSaveCard()}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cardLoading
                        ? "Abriendo Stripe…"
                        : "Sí, quiero crédito → vincular tarjeta"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {cupo?.lockReady ? (
              <div
                className="flex items-center gap-2 rounded-xl bg-[#f0faf4] px-3.5 py-3 text-[12px] font-medium text-[#0f6b3c]"
                role="status"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#16a34a]" />
                Crédito activo: cupo + tarjeta listos para fondear.
              </div>
            ) : cupo?.requestedCreditCents && !paymentMethod?.last4 ? (
              <div
                className="flex items-center gap-2 rounded-xl bg-[#fff4eb] px-3.5 py-3 text-[12px] font-medium text-[#c65113]"
                role="status"
              >
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#ff781f]" />
                Un paso más: vinculá Stripe y listo el crédito.
              </div>
            ) : (
              <div className="rounded-xl bg-[#fbf7fc] px-3.5 py-3 text-[12px] leading-5 text-[#5f0b72]">
                <strong>Tip:</strong> el crédito no se paga con Yape al
                activarlo. Yape/BCP son para el ciclo en soles; Stripe es solo el
                candado.
              </div>
            )}
          </div>
        )}

        {error ? (
          <p className="mt-4 text-[13px] text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 text-[13px] text-emerald-800" role="status">
            {success}
          </p>
        ) : null}
      </div>
    </section>
  );
}
