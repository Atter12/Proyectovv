"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { formatMoney } from "@/lib/format-money";
import type { PaymentAccountAllocation } from "@/types/payment";

interface AllocateBalanceModalProps {
  account: PaymentAccountAllocation | null;
  open: boolean;
  onClose: () => void;
  /** Passed explicitly from parent (context can break across RSC boundaries). */
  agencyBmFunding?: boolean;
}

interface AllocateResponse {
  ok: boolean;
  journalId: string;
}

/** Quita dumps técnicos (bc=/token=/req=) y deja texto usable. */
function friendlyAllocateError(raw: string, agencyBmFunding: boolean): string {
  const text = raw.trim();
  if (/amountToTransfer|mínimo|minimo|menor al mínimo|al menos \$10/i.test(text)) {
    return "TikTok pide al menos $10 en esta cuenta. Probá con $10 o más.";
  }
  if (
    /no aparece en el BM|rechazó el presupuesto|falta permiso de presupuesto|línea de crédito|crédito compartido|no tiene saldo en efectivo/i.test(
      text,
    )
  ) {
    return text.length <= 280
      ? text
      : agencyBmFunding
        ? "No se pudo recargar esa cuenta en TikTok. Probá otra cuenta Aprobada."
        : "No se pudo asignar en esta cuenta ahora. Contactá a soporte. Tu dinero sigue en la cartera.";
  }
  if (/TikTok BC transfer falló|token=agency_env|bc=\d+|adv=\d+|req=/i.test(text)) {
    return agencyBmFunding
      ? "No se pudo recargar esa cuenta en TikTok. Probá otra cuenta o contactá soporte."
      : "No se pudo asignar el saldo a esa cuenta. Tu dinero sigue en la cartera. Probá otra cuenta o contactá soporte.";
  }
  if (/Insufficient wallet balance|saldo.*cartera/i.test(text)) {
    return "No hay suficiente saldo en la cartera Holistic. Recargá e intentá de nuevo.";
  }
  if (text.length <= 220 && !/\| bc=/.test(text)) return text;
  return agencyBmFunding
    ? "No se pudo recargar desde el BM. Probá otra cuenta Aprobada o contactá soporte."
    : "No se pudo asignar el saldo. Tu dinero sigue en la cartera. Probá otra cuenta o contactá soporte.";
}

export function AllocateBalanceModal({
  account,
  open,
  onClose,
  agencyBmFunding = false,
}: AllocateBalanceModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  if (!open || !account || !mounted) return null;

  const targetAccount = account;
  const parsedAmount = Number.parseFloat(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  function resetAndClose() {
    setAmount("");
    setError(null);
    setSuccess(null);
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    if (!isValidAmount) {
      setError("Ingresá un monto válido mayor a cero.");
      return;
    }

    if (agencyBmFunding && parsedAmount < 10) {
      setError("TikTok pide al menos $10 en esta cuenta. Probá con $10 o más.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

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

      setSuccess(
        agencyBmFunding
          ? `Listo: se recargaron ${formatMoney(parsedAmount)} a ${targetAccount.name}.`
          : `Se asignaron ${formatMoney(parsedAmount)} a ${targetAccount.name}.`,
      );
      router.refresh();
    } catch (err) {
      const raw =
        err instanceof ApiClientError
          ? err.message
          : "No se pudo asignar el saldo.";
      setError(friendlyAllocateError(raw, agencyBmFunding));
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
          {agencyBmFunding ? "Recargar desde BM" : "Asignar saldo"}
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
          {agencyBmFunding
            ? "Fondea la cuenta en TikTok desde el BM (sin exigir cartera del cliente). BM 200 = cash; BM 10/30 = subir presupuesto de crédito. Usá cuentas Aprobadas."
            : "Descuenta la cartera Holistic y mueve cash del BM a esta cuenta ads. Si la cuenta ya tiene saldo en TikTok, puede seguir pautando; esto suma más presupuesto controlado por Holistic."}
        </p>
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-950">
          <span className="font-semibold">1 a 1:</span> si asignás $120, TikTok
          recibe $120. No se suma fee al asignar (el fee Holistic solo aplica al
          recargar la cartera).
        </p>
        {agencyBmFunding ? (
          <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] leading-5 text-sky-950">
            Si ves error de presupuesto, la cuenta no está visible en el BM de
            TikTok (ID mal mapeado o cuenta vieja). Probá otra Aprobada del
            mismo cliente.
          </p>
        ) : null}

        <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
          <p className="text-xs text-[var(--admin-text-muted,#64748b)]">
            Cuenta publicitaria
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
            {targetAccount.name}
          </p>
          {targetAccount.bmLabel ? (
            <span className="mt-1.5 inline-flex rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af] ring-1 ring-[#c7d7fe]">
              {targetAccount.bmLabel}
            </span>
          ) : null}
          <p className="mt-1 text-xs text-[var(--admin-text-muted,#64748b)]">
            Saldo actual: {formatMoney(targetAccount.balance)}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-[var(--admin-text-muted,#64748b)]">
            TikTok advertiser:{" "}
            {targetAccount.externalAccountId?.trim() || (
              <span className="text-red-600">no configurado</span>
            )}
          </p>
          {targetAccount.status === "disabled" ? (
            <p className="mt-2 text-[11px] leading-4 text-amber-800" role="alert">
              Esta cuenta está desactivada/suspendida. Elegí una cuenta Aprobada
              de la lista (o sincronizá de nuevo en Pagos).
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <label
            htmlFor="allocation-amount"
            className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]"
          >
            Monto a asignar (USD)
          </label>
          <Input
            id="allocation-amount"
            type="number"
            min={agencyBmFunding ? 10 : 1}
            step="0.01"
            placeholder={agencyBmFunding ? "10.00" : "100.00"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          {agencyBmFunding ? (
            <p className="mt-1.5 text-[12px] leading-5 text-[#6b645c]">
              Mínimo recomendado: <span className="font-medium text-[#1a1612]">$10</span>
              . Montos chicos ($1–$2) TikTok los rechaza.
            </p>
          ) : null}
        </div>

        {error && (
          <p
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-950"
            role="alert"
          >
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 text-xs text-emerald-600" role="status">
            {success}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            Cerrar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !isValidAmount}
            className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
          >
            {loading
              ? agencyBmFunding
                ? "Fondeando…"
                : "Asignando…"
              : agencyBmFunding
                ? "Recargar desde BM"
                : "Asignar saldo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
