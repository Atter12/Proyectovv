"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { formatMoney } from "@/lib/format-money";
import type { PaymentAccountAllocation } from "@/types/payment";

interface TransferBalanceModalProps {
  sourceAccount: PaymentAccountAllocation | null;
  allAccounts: PaymentAccountAllocation[];
  open: boolean;
  onClose: () => void;
  agencyBmFunding?: boolean;
  allowForceLedger?: boolean;
  /** Copy para cliente final (no gerente). */
  clientSelfService?: boolean;
  /** Refresca saldo TikTok en vivo (sin F5). */
  onFundingChanged?: () => void | Promise<void>;
}

interface TransferResponse {
  ok: boolean;
  amountUsd: number;
  requestedAmountUsd: number;
  fromAccountName: string;
  toAccountName: string;
  reclaimPath: string;
}

function friendlyTransferError(raw: string): string {
  const text = raw.trim();
  if (text.length <= 280 && !/\| bc=/.test(text)) return text;
  if (/cartera holistic/i.test(text)) return text;
  return "No se pudo completar la transferencia. Probá de nuevo o contactá soporte.";
}

export function TransferBalanceModal({
  sourceAccount,
  allAccounts,
  open,
  onClose,
  agencyBmFunding = false,
  allowForceLedger = false,
  clientSelfService = false,
  onFundingChanged,
}: TransferBalanceModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [forceLedgerOnly, setForceLedgerOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const destinationOptions = useMemo(
    () =>
      allAccounts.filter(
        (a) =>
          a.id !== sourceAccount?.id &&
          a.status !== "disabled" &&
          Number(a.balance) >= 0,
      ),
    [allAccounts, sourceAccount?.id],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !sourceAccount) return;
    setAmount(sourceAccount.balance > 0 ? String(sourceAccount.balance) : "");
    setToAccountId(destinationOptions[0]?.id ?? "");
    setForceLedgerOnly(false);
    setError(null);
    setSuccess(null);
  }, [open, sourceAccount, destinationOptions]);

  if (!open || !sourceAccount || !mounted) return null;

  const maxAmount = sourceAccount.balance;
  const parsed = Number.parseFloat(amount);
  const isValid =
    Boolean(toAccountId) &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    parsed <= maxAmount + 1e-9;

  const destAccount = destinationOptions.find((a) => a.id === toAccountId);

  function resetAndClose() {
    setAmount("");
    setToAccountId("");
    setError(null);
    setSuccess(null);
    setLoading(false);
    setForceLedgerOnly(false);
    onClose();
  }

  async function handleSubmit() {
    if (destinationOptions.length === 0) {
      setError("No hay otra cuenta activa para recibir el saldo.");
      return;
    }
    if (!isValid) {
      setError(
        maxAmount <= 0
          ? "No hay saldo transferible en esta cuenta."
          : `Ingresá un monto entre 0.01 y ${formatMoney(maxAmount)}.`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient<TransferResponse>("/api/payments/transfer", {
        method: "POST",
        body: JSON.stringify({
          fromAdAccountId: sourceAccount!.id,
          toAdAccountId: toAccountId,
          amount: parsed,
          agencyBmFunding,
          forceLedgerOnly: allowForceLedger ? forceLedgerOnly : false,
        }),
      });
      const partial =
        res.requestedAmountUsd > res.amountUsd + 1e-9
          ? ` (TikTok permitió ${formatMoney(res.amountUsd)} de ${formatMoney(res.requestedAmountUsd)} solicitados)`
          : "";
      setSuccess(
        `Listo: ${formatMoney(res.amountUsd)} pasaron de ${res.fromAccountName} a ${res.toAccountName}${partial}.`,
      );
      router.refresh();
      await onFundingChanged?.();
    } catch (err) {
      setError(
        friendlyTransferError(
          err instanceof ApiClientError
            ? err.message
            : "No se pudo transferir el saldo.",
        ),
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
        aria-label="Cerrar modal"
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-2xl sm:p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {clientSelfService
            ? "Pasá saldo a otra cuenta"
            : "Transferir a otra cuenta"}
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
          {clientSelfService ? (
            <>
              Podés hacerlo vos desde acá, sin esperar a soporte. Elegí de qué
              cuenta sacás y a cuál va el monto (parcial o total). Funciona aunque
              la cuenta origen esté suspendida — solo se mueve lo no gastado.
            </>
          ) : (
            <>
              Sacá saldo de una cuenta ads y pasalo directo a otra del mismo
              cliente. Funciona con cuentas activas o suspendidas (solo lo no
              gastado).
            </>
          )}
        </p>

        <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
          <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
            Desde (origen)
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
            {sourceAccount.name}
          </p>
          {sourceAccount.bmLabel ? (
            <span className="mt-1.5 inline-flex rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af] ring-1 ring-[#c7d7fe]">
              {sourceAccount.bmLabel}
            </span>
          ) : null}
          <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
            Saldo disponible: {formatMoney(sourceAccount.balance)}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Estado:{" "}
            {sourceAccount.status === "disabled"
              ? "Suspendida (igual podés transferir lo recuperable)"
              : sourceAccount.status}
          </p>
        </div>

        <div className="mt-5">
          <label
            htmlFor="transfer-dest"
            className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]"
          >
            Hacia (destino)
          </label>
          {destinationOptions.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
              No hay otra cuenta Activa/Aprobada. Sincronizá cuentas en Pagos o
              elegí una cuenta distinta.
            </p>
          ) : (
            <select
              id="transfer-dest"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2.5 text-sm text-[var(--foreground)]"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              {destinationOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.bmLabel ? ` · ${account.bmLabel}` : ""}
                  {" · "}
                  {formatMoney(account.balance)}
                </option>
              ))}
            </select>
          )}
          {destAccount ? (
            <p className="mt-1.5 font-mono text-[11px] text-[#6b645c]">
              adv {destAccount.externalAccountId?.trim() || "—"}
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <label
            htmlFor="transfer-amount"
            className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]"
          >
            Monto a transferir (USD)
          </label>
          <Input
            id="transfer-amount"
            type="number"
            min={0.01}
            max={maxAmount}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <p className="mt-1.5 text-[12px] text-[#6b645c]">
            {clientSelfService
              ? "Ejemplo: recargaste $30 y querés $15 en otra campaña. Máximo transferible: "
              : "Ejemplo: recargaste $30 y querés pasar $15 a otra campaña. Máximo: "}
            {formatMoney(maxAmount)}.
          </p>
        </div>

        {allowForceLedger ? (
          <label className="mt-4 flex items-start gap-2 text-[12px] leading-5 text-[#6b645c]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={forceLedgerOnly}
              onChange={(e) => setForceLedgerOnly(e.target.checked)}
            />
            <span>
              Solo ledger (staff): si TikTok falla en origen, igual mover en
              Holistic. Usar con cuidado.
            </span>
          </label>
        ) : null}

        {error ? (
          <p
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-950"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 text-xs text-emerald-600" role="status">
            {success}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            Cerrar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading || !isValid || destinationOptions.length === 0
            }
            className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
          >
            {loading ? "Transfiriendo…" : "Transferir saldo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
