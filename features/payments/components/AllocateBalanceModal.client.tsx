"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import type { PaymentAccountAllocation } from "@/types/payment";

interface AllocateBalanceModalProps {
  account: PaymentAccountAllocation | null;
  open: boolean;
  onClose: () => void;
  /** Passed explicitly from parent (context can break across RSC boundaries). */
  agencyBmFunding?: boolean;
  /** Refresca saldo TikTok en vivo (sin F5). */
  onFundingChanged?: () => void | Promise<void>;
  /** Saldo disponible en cartera Holistic (modo cliente). */
  walletBalance?: number;
  /** Éxito: el padre cierra y muestra banner. */
  onAllocated?: (info: {
    amount: number;
    accountName: string;
    agencyBmFunding: boolean;
  }) => void;
}

interface AllocateResponse {
  ok: boolean;
  journalId: string;
}

/** Quita dumps técnicos (bc=/token=/req=) y deja texto usable. */
function friendlyAllocateError(
  raw: string,
  agencyBmFunding: boolean,
  messages: { errMin10: string; errWallet: string },
): string {
  const text = raw.trim();
  if (/amountToTransfer|mínimo|minimo|menor al mínimo|al menos \$10/i.test(text)) {
    return messages.errMin10;
  }
  if (
    /no aparece en el BM|rechazó el presupuesto|falta permiso de presupuesto|línea de crédito|crédito compartido|portfolio de crédito|no tiene saldo en efectivo|no tiene cupo disponible|limitó los cambios de presupuesto|FrequencyControl/i.test(
      text,
    )
  ) {
    return text.length <= 280
      ? text
      : agencyBmFunding
        ? "No se pudo recargar esa cuenta en TikTok. Prueba con otra cuenta aprobada."
        : "No se pudo asignar saldo a esta cuenta. Contacta con soporte. Tu dinero sigue en la cartera.";
  }
  if (/TikTok BC transfer falló|token=agency_env|bc=\d+|adv=\d+|req=/i.test(text)) {
    return agencyBmFunding
      ? "No se pudo recargar esa cuenta en TikTok. Prueba con otra cuenta o contacta con soporte."
      : "No se pudo asignar el saldo a esa cuenta. Tu dinero sigue en la cartera. Prueba con otra cuenta o contacta con soporte.";
  }
  if (/Insufficient wallet balance|saldo.*cartera/i.test(text)) {
    return messages.errWallet;
  }
  if (text.length <= 220 && !/\| bc=/.test(text)) return text;
  return agencyBmFunding
    ? "No se pudo recargar desde el BM. Prueba con otra cuenta aprobada o contacta con soporte."
    : "No se pudo asignar el saldo. Tu dinero sigue en la cartera. Prueba con otra cuenta o contacta con soporte.";
}

export function AllocateBalanceModal({
  account,
  open,
  onClose,
  agencyBmFunding = false,
  onFundingChanged,
  walletBalance = 0,
  onAllocated,
}: AllocateBalanceModalProps) {
  const router = useRouter();
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const { formatMoney } = useAppFormatter();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !account) return;
    setError(null);
    if (agencyBmFunding) {
      setAmount("");
      return;
    }
    const available = Math.max(0, Number(walletBalance) || 0);
    setAmount(available > 0 ? String(Math.round(available * 100) / 100) : "");
  }, [open, account, agencyBmFunding, walletBalance]);

  if (!open || !account || !mounted) return null;

  const targetAccount = account;
  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const walletAvailable = Math.max(0, Number(walletBalance) || 0);
  const alreadyOnAccount = Math.max(0, Number(targetAccount.balance) || 0);

  function resetAndClose() {
    setAmount("");
    setError(null);
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    if (!isValidAmount) {
      setError(t("allocateModal.errInvalid"));
      return;
    }

    if (agencyBmFunding && parsedAmount < 10) {
      setError(t("allocateModal.errMin10"));
      return;
    }

    if (!agencyBmFunding && parsedAmount > walletAvailable + 1e-9) {
      setError(t("allocateModal.errWallet"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient<AllocateResponse>("/api/payments/allocations", {
        method: "POST",
        body: JSON.stringify({
          adAccountId: targetAccount.id,
          amount: parsedAmount,
          currency: "USD",
          agencyBmFunding,
        }),
      });

      // Cerrar ya: refresh live / RSC no debe frenar el UX.
      onAllocated?.({
        amount: parsedAmount,
        accountName: targetAccount.name,
        agencyBmFunding,
      });
      resetAndClose();
      void Promise.resolve(onFundingChanged?.()).finally(() => {
        router.refresh();
      });
    } catch (err) {
      const raw =
        err instanceof ApiClientError
          ? err.message
          : t("allocateModal.errGeneric");
      setError(
        friendlyAllocateError(raw, agencyBmFunding, {
          errMin10: t("allocateModal.errMin10"),
          errWallet: t("allocateModal.errWallet"),
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/45 backdrop-blur-sm"
        aria-label={t("allocateModal.closeAria")}
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-2xl sm:p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {agencyBmFunding
            ? t("allocateModal.titleBm")
            : t("allocateModal.title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
          {agencyBmFunding
            ? t("allocateModal.bodyBm")
            : t("allocateModal.body")}
        </p>
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-950">
          <span className="font-semibold">{t("allocateModal.oneToOne")}</span>{" "}
          {t("allocateModal.oneToOneBody")}
        </p>
        {agencyBmFunding ? (
          <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] leading-5 text-sky-950">
            Si ves error de presupuesto, la cuenta no está visible en el BM de
            TikTok (ID mal mapeado o cuenta antigua). Prueba con otra cuenta aprobada del
            mismo cliente.
          </p>
        ) : null}

        <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
          <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
            {t("allocateModal.account")}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
            {targetAccount.name}
          </p>
          {targetAccount.bmLabel ? (
            <span className="mt-1.5 inline-flex rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af] ring-1 ring-[#c7d7fe]">
              {targetAccount.bmLabel}
            </span>
          ) : null}
          {!agencyBmFunding ? (
            <div className="mt-3 space-y-1.5 text-xs leading-5">
              <p className="flex items-baseline justify-between gap-3 text-[var(--admin-text-muted,#64748b)]">
                <span>{t("allocateModal.walletAvailable")}</span>
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatMoney(walletAvailable)}
                </span>
              </p>
              <p className="flex items-baseline justify-between gap-3 text-[var(--admin-text-muted,#64748b)]">
                <span>{t("allocateModal.alreadyOnAccount")}</span>
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatMoney(alreadyOnAccount)}
                </span>
              </p>
              <p className="pt-1 text-[11px] leading-4 text-[#6b645c]">
                “Ya en esta cuenta” no se asigna otra vez. Solo puedes mover el saldo de la
                cartera.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
              Saldo / ledger: {formatMoney(targetAccount.balance)}
            </p>
          )}
          <p className="mt-2 break-all font-mono text-[11px] text-[var(--admin-text-muted,#64748b)]">
            TikTok advertiser:{" "}
            {targetAccount.externalAccountId?.trim() || (
              <span className="text-red-600">
                {t("allocateModal.notConfigured")}
              </span>
            )}
          </p>
          {targetAccount.status === "disabled" ? (
            <p className="mt-2 text-[11px] leading-4 text-amber-800" role="alert">
              Esta cuenta está desactivada o suspendida. Elige una cuenta aprobada
              de la lista o vuelve a sincronizar las cuentas en Pagos.
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <label
            htmlFor="allocation-amount"
            className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]"
          >
            {t("allocateModal.amountLabel")}
          </label>
          <Input
            id="allocation-amount"
            type="number"
            min={agencyBmFunding ? 10 : 0.01}
            step="0.01"
            max={!agencyBmFunding ? walletAvailable || undefined : undefined}
            placeholder={agencyBmFunding ? "10.00" : "100.00"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          {agencyBmFunding ? (
            <p className="mt-1.5 text-[12px] leading-5 text-[#6b645c]">
              {t("allocateModal.minHint")}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] leading-5 text-[#6b645c]">
              Máximo ahora:{" "}
              <span className="font-medium text-[#1a1612]">
                {formatMoney(walletAvailable)}
              </span>{" "}
              (cartera).
            </p>
          )}
        </div>

        {error && (
          <p
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-950"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            {tCommon("close")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !isValidAmount}
            className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
          >
            {loading
              ? agencyBmFunding
                ? t("allocateModal.funding")
                : t("allocateModal.assigning")
              : agencyBmFunding
                ? t("allocateModal.fundCta")
                : t("allocateModal.assignCta")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
