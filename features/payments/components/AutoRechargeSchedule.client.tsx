"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import {
  depositFromDesiredCredit,
  formatFeePercentLabel,
} from "@/lib/payments/deposit-fee";
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
  const t = useTranslations("payments");
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
        setError(userErrorMessage(err, t("autoRecharge.errLoad")));
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
        setSuccess(t("autoRecharge.successCard"));
        router.replace("/payments");
        await load();
      } catch (err) {
        setError(userErrorMessage(err, t("autoRecharge.errConfirmCard")));
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
      throw new Error(t("autoRecharge.errStripeUrl"));
    } catch (err) {
      setError(userErrorMessage(err, t("autoRecharge.errOpenCard")));
      setCardLoading(false);
    }
  }

  async function handleSaveSchedule() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (enabled && !paymentMethod?.last4) {
      setError(t("autoRecharge.errNeedCard"));
      setSaving(false);
      return;
    }

    const credit = Number(amount);
    if (!Number.isFinite(credit) || credit < 10) {
      setError(t("autoRecharge.errMin"));
      setSaving(false);
      return;
    }
    if (credit > 5000) {
      setError(t("autoRecharge.errMax"));
      setSaving(false);
      return;
    }

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
          ? t("autoRecharge.successEnabled", {
              amount: formatMoney(
                preview?.grossCents ? preview.grossCents / 100 : credit,
              ),
              days: intervalDays,
            })
          : t("autoRecharge.successDisabled"),
      );
      await load();
    } catch (err) {
      setError(userErrorMessage(err, t("autoRecharge.errSave")));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="dashboard-surface-card rounded-[1rem] px-5 py-5 sm:px-6">
        <p className="text-[13px] text-[var(--auth-text-muted)]">{t("autoRecharge.loading")}</p>
      </section>
    );
  }

  return (
    <section className="dashboard-surface-card rounded-[1rem] px-5 py-5 sm:px-6 sm:py-6">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
        {t("autoRecharge.eyebrow")}
      </p>
      <h2 className="mt-1.5 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
        {t("autoRecharge.title")}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
        <strong className="font-semibold text-[var(--auth-text)]">
          {t("autoRecharge.step1")}
        </strong>
        {t("autoRecharge.step1Body")}{" "}
        <strong className="font-semibold text-[var(--auth-text)]">
          {t("autoRecharge.step2")}
        </strong>
        {t("autoRecharge.step2Body")}{" "}
        <strong className="font-semibold text-[var(--auth-text)]">
          {t("autoRecharge.step3")}
        </strong>
        {t("autoRecharge.step3Body")}{" "}
        {t("autoRecharge.feeNote", {
          percent: formatFeePercentLabel(depositFeePercent),
        })}
      </p>

      <div className="mt-5 rounded-xl border border-[var(--auth-divider)] bg-[var(--auth-surface-muted)]/40 p-4">
        <p className="text-[12px] font-semibold text-[var(--auth-text)]">{t("autoRecharge.card")}</p>
        {paymentMethod?.last4 ? (
          <p className="mt-1 text-[13px] text-[var(--auth-text-muted)]">
            {(paymentMethod.brand ?? t("autoRecharge.cardFallback")).toUpperCase()} ·••• {paymentMethod.last4}
            {paymentMethod.expMonth && paymentMethod.expYear
              ? ` · ${t("autoRecharge.expires", { month: paymentMethod.expMonth, year: String(paymentMethod.expYear).slice(-2) })}`
              : ""}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-amber-700">
            {t("autoRecharge.noCard")}
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
            ? t("autoRecharge.redirecting")
            : paymentMethod?.last4
              ? t("autoRecharge.changeCard")
              : t("autoRecharge.saveCard")}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12px] font-semibold text-[var(--auth-text)]">
            {t("autoRecharge.intervalLabel")}
          </span>
          <select
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--auth-control-border)] bg-white px-3 text-[14px]"
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
          >
            {INTERVAL_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {t("autoRecharge.everyDays", { days })}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[var(--auth-text)]">
            {t("autoRecharge.amountLabel")}
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
          {t("autoRecharge.previewBefore")}{" "}
          <span className="font-semibold text-[var(--auth-text)]">
            {formatMoney(preview.grossCents / 100)}
          </span>{" "}
          {t("autoRecharge.previewMid")}{" "}
          <span className="font-semibold text-[var(--auth-text)]">
            {formatMoney(preview.creditCents / 100)}
          </span>{" "}
          {t("autoRecharge.previewAfter")}
        </p>
      ) : null}

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[var(--auth-text)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--auth-control-border)]"
        />
        {t("autoRecharge.enable")}
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
        {saving ? t("autoRecharge.saving") : t("autoRecharge.save")}
      </Button>
    </section>
  );
}
