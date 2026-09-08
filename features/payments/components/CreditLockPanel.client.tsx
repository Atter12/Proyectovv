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

const QUICK_AMOUNTS = [300, 500, 700, 1000] as const;

export function CreditLockPanel({
  clienteName,
  visible = true,
}: CreditLockPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detachLoading, setDetachLoading] = useState(false);
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
        setSuccess("Listo. Tu crédito ya está activo.");
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

  const amountSaved =
    cupo?.requestedCreditUsd != null &&
    Math.round(cupo.requestedCreditUsd) === Math.round(Number(amountInput) || 0);

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

  /** Un solo flujo: guarda monto (si hace falta) y abre Stripe. */
  async function handleContinue() {
    const usd = Number(amountInput);
    if (!Number.isFinite(usd) || usd < 50) {
      setError("Elige un monto de al menos $50.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (!amountSaved) {
        await saveCupo(usd);
      }
      if (paymentMethod?.last4) {
        setSuccess(`Cupo actualizado a ${formatMoney(usd, "USD")}.`);
        setBusy(false);
        return;
      }
      await openStripe();
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo continuar."));
      setBusy(false);
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
  const step = cupo?.lockReady ? 2 : cupo?.requestedCreditCents ? 1 : 0;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white"
      aria-label={`Crédito para ${clienteName}`}
    >
      <header className="border-b border-[#eee8e2] bg-[#fffaf6] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <GatewayLogo gatewayId="stripe" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#1c1917]">
              Crédito Holistic
            </p>
            <p className="mt-0.5 text-[11px] text-[#6f675f]">
              Solo con Stripe · Visa / Mastercard
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PaymentAppIcon app="visa" size="sm" />
            <PaymentAppIcon app="mastercard" size="sm" />
          </div>
        </div>

        <h2 className="mt-5 text-[1.4rem] font-semibold tracking-[-0.03em] text-[#171412]">
          ¿Quieres tener crédito?
        </h2>
        <p className="mt-1.5 max-w-[40rem] text-[13px] leading-5 text-[#625b54]">
          Gasta ahora y paga el ciclo después. Actívalo con una tarjeta Stripe.
          Yape o BCP los usas luego para pagar en soles.
        </p>

        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Pasos">
          {(["1. Monto", "2. Tarjeta", "3. Listo"] as const).map((label, i) => (
            <li key={label}>
              <span
                className={cn(
                  "block h-1 rounded-full",
                  i <= step ? "bg-[#ff781f]" : "bg-[#e5ddd5]",
                )}
              />
              <span
                className={cn(
                  "mt-1.5 block text-[10px] font-semibold",
                  i === step ? "text-[#1c1917]" : "text-[#8a8177]",
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
                  Si pides {formatMoney(preview.requested, "USD")}, conviene
                  tener al menos {formatMoney(preview.recommended, "USD")} en la
                  tarjeta (+{preview.headroom}%).
                </p>
              </div>
            ) : null}

            {paymentMethod?.last4 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7dfd7] px-4 py-3.5">
                <div>
                  <p className="text-[11px] text-[#6f675f]">Tarjeta registrada</p>
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
                    onClick={() => void handleContinue()}
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
            ) : (
              <button
                type="button"
                disabled={busy || !preview}
                onClick={() => void handleContinue()}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Abriendo Stripe…" : "Continuar con Stripe"}
              </button>
            )}

            {cupo?.lockReady ? (
              <p className="rounded-xl bg-[#f0faf4] px-3.5 py-3 text-[12px] font-medium text-[#0f6b3c]">
                Crédito activo. Ya puedes usar tu cupo.
              </p>
            ) : !paymentMethod?.last4 ? (
              <p className="text-[12px] leading-5 text-[#6f675f]">
                Un solo paso: elige el monto y registra tu tarjeta. El equipo
                confirma según tu historial.
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
