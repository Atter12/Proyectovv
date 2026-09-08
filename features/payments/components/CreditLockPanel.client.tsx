"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
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

type DebtState = {
  saldoEstimado: number;
  debtUsd: number;
  debtCents: number;
  chargeable: boolean;
} | null;

interface CreditLockPanelProps {
  clienteName: string;
  /** Solo visible para modalidad crédito; el padre controla el mount. */
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodState>(null);
  const [debt, setDebt] = useState<DebtState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<{
        ok: boolean;
        paymentMethod: PaymentMethodState;
        debt: DebtState;
      }>("/api/billing/payment-method");
      setPaymentMethod(data.paymentMethod);
      setDebt(data.debt);
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
        setSuccess("Tarjeta guardada. El cupo crédito queda con candado Stripe.");
        router.replace("/payments");
        await load();
      } catch (err) {
        setError(userErrorMessage(err, "No se pudo confirmar la tarjeta."));
      }
    })();
  }, [searchParams, router, load, visible]);

  if (!visible) return null;

  async function handleSaveCard() {
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
    const debtLabel = debt?.chargeable
      ? formatMoney(debt.debtUsd, "USD")
      : null;
    const ok = window.confirm(
      debtLabel
        ? `Al quitar la tarjeta se cobrará ${debtLabel} (deuda Hecom viva) con Stripe. Si el cobro falla, la tarjeta sigue vinculada. ¿Continuar?`
        : "¿Quitar la tarjeta guardada? Sin deuda viva no se cobra nada.",
    );
    if (!ok) return;

    setDetachLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiClient<{
        ok: boolean;
        chargedCents: number;
      }>("/api/billing/payment-method", { method: "DELETE" });
      if (data.chargedCents > 0) {
        setSuccess(
          `Cobramos ${formatMoney(data.chargedCents / 100, "USD")} y quitamos la tarjeta.`,
        );
      } else {
        setSuccess("Tarjeta quitada.");
      }
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
            Candado crédito
          </p>
          <h2 className="text-[16px] font-semibold text-[var(--auth-text)]">
            Tarjeta Stripe anti-vivo
          </h2>
          <p className="max-w-xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
            Guardá una tarjeta para el cupo. Si la quitás con deuda Hecom, cobramos
            lo gastado. El ciclo en soles sigue por Yape/BCP.
          </p>
        </div>
        {debt != null ? (
          <div className="rounded-xl bg-white/70 px-3 py-2 text-right ring-1 ring-amber-200/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/60">
              Deuda viva
            </p>
            <p
              className={`text-[15px] font-semibold tabular-nums ${
                debt.debtCents > 0 ? "text-amber-950" : "text-emerald-800"
              }`}
            >
              {debt.debtCents > 0
                ? formatMoney(debt.debtUsd, "USD")
                : "Al día"}
            </p>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-[13px] text-[var(--auth-text-muted)]">
          Cargando…
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
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
              disabled={cardLoading}
              onClick={() => void handleSaveCard()}
            >
              {cardLoading ? "Abriendo Stripe…" : "Guardar tarjeta (candado)"}
            </Button>
          )}
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
