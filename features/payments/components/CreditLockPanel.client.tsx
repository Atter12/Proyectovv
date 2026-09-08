"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
      setError(userErrorMessage(err, "No se pudo cargar el candado Stripe."));
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
        setSuccess("Tarjeta Stripe guardada. El crédito queda habilitado con candado.");
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
        `Cupo registrado: ${formatMoney(Number(amountInput), "USD")}. En la tarjeta conviene tener al menos ${formatMoney(data.cupo?.recommendedCardUsd ?? 0, "USD")}.`,
      );
    } catch (err) {
      setError(userErrorMessage(err, "No se pudo guardar el monto de crédito."));
    } finally {
      setSavingCupo(false);
    }
  }

  async function handleSaveCard() {
    if (!cupo?.requestedCreditCents) {
      setError("Primero indicá cuánto crédito pedís (USD) y guardá el monto.");
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
      setError(userErrorMessage(err, "No se pudo abrir el formulario de tarjeta."));
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
      className="rounded-[1.25rem] border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-[var(--auth-surface)] px-4 py-4 sm:px-5 sm:py-5"
      aria-label={`Candado Stripe crédito — ${clienteName}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-900/70">
            Crédito · solo Stripe
          </p>
          <h2 className="text-[16px] font-semibold text-[var(--auth-text)]">
            Habilitar crédito con tarjeta
          </h2>
          <p className="max-w-xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
            El cupo crédito se habilita <strong>solo con tarjeta Stripe</strong>{" "}
            (candado). Yape / BCP sirven para pagar el ciclo en soles, no
            reemplazan la tarjeta.
          </p>
        </div>
        {cupo?.requestedCreditUsd != null ? (
          <div className="rounded-xl bg-white/70 px-3 py-2 text-right ring-1 ring-amber-200/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/60">
              Cupo pedido
            </p>
            <p className="text-[15px] font-semibold tabular-nums text-amber-950">
              {formatMoney(cupo.requestedCreditUsd, "USD")}
            </p>
            {cupo.recommendedCardUsd != null ? (
              <p className="mt-0.5 text-[11px] text-amber-900/70">
                Tarjeta ≈ {formatMoney(cupo.recommendedCardUsd, "USD")}+
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-[13px] text-[var(--auth-text-muted)]">
          Cargando…
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[10rem] flex-1 space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--auth-text-muted)]">
                Monto de crédito (USD)
              </span>
              <Input
                type="number"
                min={50}
                max={50000}
                step={50}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="700"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={savingCupo}
              onClick={() => void handleSaveCupo()}
            >
              {savingCupo ? "Guardando…" : "Guardar monto"}
            </Button>
          </div>

          {preview ? (
            <p className="text-[13px] leading-5 text-[var(--auth-text-muted)]">
              Pedís{" "}
              <span className="font-semibold text-[var(--auth-text)]">
                {formatMoney(preview.requested, "USD")}
              </span>
              . En la tarjeta conviene tener al menos{" "}
              <span className="font-semibold text-[var(--auth-text)]">
                {formatMoney(preview.recommended, "USD")}
              </span>{" "}
              (+{preview.headroom}% de margen).
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {paymentMethod?.last4 ? (
              <>
                <p className="text-[13px] font-medium text-[var(--auth-text)]">
                  {brand} ···· {last4}
                  {paymentMethod.expMonth && paymentMethod.expYear
                    ? ` · ${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`
                    : ""}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={cardLoading}
                  onClick={() => void handleSaveCard()}
                >
                  {cardLoading ? "Abriendo…" : "Cambiar tarjeta"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={detachLoading}
                  onClick={() => void handleDetach()}
                >
                  {detachLoading ? "Procesando…" : "Quitar tarjeta"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={cardLoading || !cupo?.requestedCreditCents}
                onClick={() => void handleSaveCard()}
              >
                {cardLoading
                  ? "Abriendo Stripe…"
                  : "Guardar tarjeta Stripe (obligatorio)"}
              </Button>
            )}
          </div>

          {cupo?.lockReady ? (
            <p className="text-[12px] text-emerald-800">
              Listo: cupo + tarjeta Stripe. Ya se puede fondear dentro del tope.
            </p>
          ) : cupo?.requestedCreditCents && !paymentMethod?.last4 ? (
            <p className="text-[12px] text-amber-900">
              Falta vincular la tarjeta Stripe para activar el crédito.
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
    </section>
  );
}
