"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { formatMoney } from "@/lib/format-money";
import { mapAdAccountStatusLabel } from "@/lib/ui/labels";
import { PaymentsEmptyState } from "./PaymentsEmptyState";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsTableProps {
  accounts: PaymentAccountAllocation[];
  onAllocate?: (account: PaymentAccountAllocation) => void;
  onEditTikTokIds?: (account: PaymentAccountAllocation) => void;
  /** Modo gerente BM: copy “Recargar” en vez de “Asignar”. */
  agencyBmFunding?: boolean;
}

interface AllocationResponse {
  ok: boolean;
  ledgerJournalId: string;
}

export function PaymentsTable({
  accounts,
  onAllocate,
  onEditTikTokIds,
  agencyBmFunding = false,
}: PaymentsTableProps) {
  const router = useRouter();
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;
  const actionLabel = agencyBmFunding ? "Recargar" : "Asignar";
  const actionLabelLong = agencyBmFunding ? "Recargar saldo" : "Asignar saldo";
  const actionLoading = agencyBmFunding ? "Recargando…" : "Asignando…";

  async function handleAllocate(account: PaymentAccountAllocation) {
    const rawAmount = window.prompt(
      `Monto a asignar a ${account.name} en USD`,
      "100",
    );
    if (!rawAmount) return;

    const amount = Number.parseFloat(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresa un monto válido mayor a cero.");
      return;
    }

    setLoadingAccountId(account.id);
    setMessage(null);
    setError(null);

    try {
      await apiClient<AllocationResponse>("/api/payments/allocations", {
        method: "POST",
        body: JSON.stringify({
          adAccountId: account.id,
          amount,
        }),
      });
      setMessage(`Asignación de ${formatMoney(amount)} enviada al ledger.`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo asignar saldo a la cuenta.",
      );
    } finally {
      setLoadingAccountId(null);
    }
  }

  function runAllocate(account: PaymentAccountAllocation) {
    if (onAllocate) onAllocate(account);
    else void handleAllocate(account);
  }

  return (
    <div>
      {(message || error) && (
        <div
          className={`mx-4 mb-3 rounded-xl border px-4 py-3 text-[13px] ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
          role="status"
        >
          {error ?? message}
        </div>
      )}

      {!isEmpty ? (
        <div className="space-y-2.5 p-4 md:hidden">
          {accounts.map((account) => (
            <article
              key={account.id}
              className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-4 transition-colors hover:bg-[#faf7f3]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                    {account.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-[#9a9187]">
                    adv{" "}
                    {account.externalAccountId?.trim() || "— sin TikTok ID —"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-[#fff7eb] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e] ring-1 ring-[#f0d9b0]">
                      {mapAdAccountStatusLabel(account.status)}
                    </span>
                    <span
                      className={
                        account.autoRecharge
                          ? "rounded bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#1f5c40]"
                          : "rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b645c]"
                      }
                    >
                      {account.autoRecharge ? "Auto on" : "Auto off"}
                    </span>
                  </div>
                </div>
                <p className="shrink-0 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[#1a1612]">
                  {formatMoney(account.balance)}
                </p>
              </div>
              {account.thresholdInfo ? (
                <p className="mt-2 truncate text-[11px] text-[#9a9187]">
                  {account.thresholdInfo}
                </p>
              ) : null}
              <Button
                className="mt-4 h-11 w-full rounded-lg bg-[#e85a1c] text-[13px] font-semibold hover:bg-[#d14e16]"
                disabled={loadingAccountId === account.id}
                onClick={() => runAllocate(account)}
              >
                {loadingAccountId === account.id ? actionLoading : actionLabelLong}
              </Button>
              {onEditTikTokIds ? (
                <button
                  type="button"
                  className="mt-2 w-full text-center text-[12px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
                  onClick={() => onEditTikTokIds(account)}
                >
                  Cambiar ID TikTok
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {!isEmpty ? (
        <div className="hidden md:block overflow-x-auto">
          <Table embedded className="rounded-none">
            <TableHeader>
              <TableRow className="border-b border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3] hover:bg-[#faf7f3]">
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  Cuenta
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  Estado
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  Saldo
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  Recarga
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  Umbral
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className="border-b border-[rgb(20_18_16_/_0.05)] transition-colors hover:bg-[#faf7f3]"
                >
                  <TableCell className="text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                    <div className="min-w-0">
                      <p className="truncate">{account.name}</p>
                      <p className="mt-0.5 truncate font-mono text-[10px] font-normal text-[#9a9187]">
                        adv{" "}
                        {account.externalAccountId?.trim() ||
                          "— sin TikTok ID —"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-md bg-[#fff7eb] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e] ring-1 ring-[#f0d9b0]">
                      {mapAdAccountStatusLabel(account.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[#1a1612]">
                    {formatMoney(account.balance)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        account.autoRecharge
                          ? "text-[12px] font-semibold text-[#1f5c40]"
                          : "text-[12px] text-[#7a736a]"
                      }
                    >
                      {account.autoRecharge ? "Activada" : "Desactivada"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b645c]">
                      {account.thresholdInfo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-semibold text-[#c45a18]"
                        disabled={loadingAccountId === account.id}
                        onClick={() => runAllocate(account)}
                      >
                        {loadingAccountId === account.id
                          ? actionLoading
                          : actionLabel}
                      </Button>
                      {onEditTikTokIds ? (
                        <button
                          type="button"
                          className="px-2 text-[11px] font-medium text-[#8a8178] underline-offset-2 hover:text-[#c45a18] hover:underline"
                          onClick={() => onEditTikTokIds(account)}
                        >
                          Cambiar ID TikTok
                        </button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {isEmpty && <PaymentsEmptyState />}
    </div>
  );
}
