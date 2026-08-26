"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import {
  depositFromDesiredCredit,
  formatFeePercentLabel,
} from "@/lib/payments/deposit-fee";

type PaymentMethodState = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
} | null;

type RuleState = {
  enabled: boolean;
  calendarEnabled: boolean;
  intervalDays: number | null;
  creditCents: number | null;
  nextChargeAt: string | null;
  lastChargeAt: string | null;
  lastChargeStatus: string | null;
} | null;

interface AutoRechargeScheduleProps {
  depositFeePercent?: number;
}

const INTERVAL_OPTIONS = [15, 20, 30];

export function AutoRechargeSchedule({
  depositFeePercent = 10,
}: AutoRechargeScheduleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodState>(null);
  const [enabled, setEnabled] = useState(false);
  const [intervalDays, setIntervalDays] = useState(20);
  const [amount, setAmount] = useState("200");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<{
        ok: boolean;
        paymentMethod: PaymentMethodState;
        rule: RuleState;
      }>("/api/auto-recharge/rule");
      setPaymentMethod(data.paymentMethod);
      if (data.rule) {
        setEnabled(data.rule.enabled && data.rule.calendarEnabled);
        if (data.rule.intervalDays) setIntervalDays(data.rule.intervalDays);
        if (data.rule.creditCents) {
          setAmount(String(data.rule.creditCents / 100));
        }
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 500) {
        setError(null);
      } else {
        setError(
          err instanceof Error ? err.message : "No se pudo cargar la configuración.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const setup = searchParams.get("billing_setup");
    const sessionId = searchParams.get("session_id");
    if (setup !== "success" || !sessionId) return;

    void (async () => {
      try {
        await apiClient("/api/billing/complete-setup", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
        setSuccess("Tarjeta guardada correctamente.");
        router.replace("/payments");
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo confirmar la tarjeta.",
        );
      }
    })();
  }, [searchParams, router, load]);

  const preview = useMemo(() => {
    const credit = Number(amount);
    if (!Number.isFinite(credit) || credit <= 0) return null;
    return depositFromDesiredCredit(Math.round(credit * 100), depositFeePercent);
  }, [amount, depositFeePercent]);

  async function handleSaveCard() {
    setCardLoading(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Error al guardar tarjeta.");
      setCardLoading(false);
    }
  }

  async function handleSaveSchedule() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient("/api/auto-recharge/rule", {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          intervalDays,
          creditAmount: Number(amount),
        }),
      });
      setSuccess(
        enabled
          ? `Recarga automática activada: $${amount} cada ${intervalDays} días.`
          : "Recarga automática desactivada.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="dashboard-surface-card rounded-[1rem] px-5 py-5 sm:px-6">
        <p className="text-[13px] text-[var(--auth-text-muted)]">Cargando recarga automática…</p>
      </section>
    );
  }

  return (
    <section className="dashboard-surface-card rounded-[1rem] px-5 py-5 sm:px-6 sm:py-6">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
        Recarga automática
      </p>
      <h2 className="mt-1.5 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
        Programá cobros con tu tarjeta
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
        Guardá tu tarjeta y elegí cada cuántos días y cuánto querés recargar en
        cartera. Se cobra el neto + fee Holistic ({formatFeePercentLabel(depositFeePercent)}).
      </p>

      <div className="mt-5 rounded-xl border border-[var(--auth-divider)] bg-[var(--auth-surface-muted)]/40 p-4">
        <p className="text-[12px] font-semibold text-[var(--auth-text)]">Tarjeta</p>
        {paymentMethod?.last4 ? (
          <p className="mt-1 text-[13px] text-[var(--auth-text-muted)]">
            {(paymentMethod.brand ?? "Tarjeta").toUpperCase()} ·••• {paymentMethod.last4}
            {paymentMethod.expMonth && paymentMethod.expYear
              ? ` · vence ${paymentMethod.expMonth}/${String(paymentMethod.expYear).slice(-2)}`
              : ""}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-[var(--auth-text-muted)]">
            Todavía no hay tarjeta guardada.
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          disabled={cardLoading}
          onClick={() => void handleSaveCard()}
        >
          {cardLoading
            ? "Redirigiendo a Stripe…"
            : paymentMethod?.last4
              ? "Cambiar tarjeta"
              : "Guardar tarjeta"}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12px] font-semibold text-[var(--auth-text)]">
            Cada cuántos días
          </span>
          <select
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--auth-control-border)] bg-white px-3 text-[14px]"
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
          >
            {INTERVAL_OPTIONS.map((days) => (
              <option key={days} value={days}>
                Cada {days} días
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[var(--auth-text)]">
            Monto neto en cartera (USD)
          </span>
          <Input
            type="number"
            min={10}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5"
          />
        </label>
      </div>

      {preview ? (
        <p className="mt-3 text-[12px] text-[var(--auth-text-muted)]">
          Se cobrará{" "}
          <span className="font-semibold text-[var(--auth-text)]">
            {formatMoney(preview.grossCents / 100)}
          </span>{" "}
          en la tarjeta → llegan{" "}
          <span className="font-semibold text-[var(--auth-text)]">
            {formatMoney(preview.creditCents / 100)}
          </span>{" "}
          a la cartera.
        </p>
      ) : null}

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[var(--auth-text)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--auth-control-border)]"
        />
        Activar recarga automática
      </label>

      {error ? (
        <p className="mt-3 text-[13px] font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-[13px] font-medium text-emerald-700" role="status">
          {success}
        </p>
      ) : null}

      <Button
        type="button"
        className="mt-4"
        disabled={saving}
        onClick={() => void handleSaveSchedule()}
      >
        {saving ? "Guardando…" : "Guardar programación"}
      </Button>
    </section>
  );
}
