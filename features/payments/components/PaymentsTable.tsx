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
import { PaymentsAccountBalanceCell } from "./PaymentsAccountBalanceCell.client";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsTableProps {
  accounts: PaymentAccountAllocation[];
  onAllocate?: (account: PaymentAccountAllocation) => void;
  onReclaim?: (account: PaymentAccountAllocation) => void;
  onTransfer?: (account: PaymentAccountAllocation) => void;
  onEditTikTokIds?: (account: PaymentAccountAllocation) => void;
  /** Modo gerente BM: copy “Recargar” en vez de “Asignar”. */
  agencyBmFunding?: boolean;
  /** Hint de autoservicio para clientes (no gerente). */
  clientSelfService?: boolean;
  liveMetricsByAdvertiser?: Record<string, AdAccountLiveMetricsClient>;
  liveMetricsLoading?: boolean;
}

interface AllocationResponse {
  ok: boolean;
  ledgerJournalId: string;
}

function isReclaimableSuspended(account: PaymentAccountAllocation): boolean {
  return account.status === "disabled" && Number(account.balance) > 0;
}

function hasTransferableBalance(
  account: PaymentAccountAllocation,
  liveUsd: number | null | undefined,
): boolean {
  if (liveUsd != null) return liveUsd > 0.005;
  return Number(account.balance) > 0;
}

function statusBadgeClass(status: string): string {
  if (status === "disabled") {
    return "rounded-md bg-[#fef2f2] px-1.5 py-0.5 text-[10px] font-semibold text-[#991b1b] ring-1 ring-[#fecaca]";
  }
  if (status === "active") {
    return "rounded-md bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#1f5c40] ring-1 ring-[#b8e6cc]";
  }
  return "rounded-md bg-[#fff7eb] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e] ring-1 ring-[#f0d9b0]";
}

export function PaymentsTable({
  accounts,
  onAllocate,
  onReclaim,
  onTransfer,
  onEditTikTokIds,
  agencyBmFunding = false,
  clientSelfService = false,
  liveMetricsByAdvertiser,
  liveMetricsLoading = false,
}: PaymentsTableProps) {
  const router = useRouter();
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;
  const actionLabel = agencyBmFunding ? "Recargar" : "Asignar";
  const actionLabelLong = agencyBmFunding ? "Recargar saldo" : "Asignar saldo";
  const actionLoading = agencyBmFunding ? "Recargando…" : "Asignando…";
  const balanceColumnLabel = agencyBmFunding ? "TikTok en vivo" : "Saldo / cupo";

  function renderBalanceCell(account: PaymentAccountAllocation, compact = false) {
    const advertiserId = account.externalAccountId?.trim();
    const metric = advertiserId ? liveMetricsByAdvertiser?.[advertiserId] : undefined;

    return (
      <PaymentsAccountBalanceCell
        ledgerBalance={account.balance}
        advertiserId={advertiserId}
        metric={metric}
        loading={liveMetricsLoading}
        agencyBmFunding={agencyBmFunding}
        compact={compact}
      />
    );
  }

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

  function runReclaim(account: PaymentAccountAllocation) {
    if (onReclaim) onReclaim(account);
  }

  function runTransfer(account: PaymentAccountAllocation) {
    if (onTransfer) onTransfer(account);
  }

  function renderActions(account: PaymentAccountAllocation, mobile: boolean) {
    const reclaimable = isReclaimableSuspended(account);
    const advertiserId = account.externalAccountId?.trim();
    const liveUsd = advertiserId
      ? liveMetricsByAdvertiser?.[advertiserId]?.balanceUsd
      : undefined;
    const transferable = hasTransferableBalance(account, liveUsd);

    return (
      <div className={mobile ? "mt-4 space-y-2" : "flex flex-col items-start gap-1"}>
        {transferable && onTransfer ? (
          <Button
            className={
              mobile
                ? "h-11 w-full rounded-lg bg-[#e85a1c] text-[13px] font-semibold hover:bg-[#d14e16]"
                : "font-semibold text-[#c45a18]"
            }
            variant={mobile ? undefined : "ghost"}
            size={mobile ? undefined : "sm"}
            onClick={() => runTransfer(account)}
          >
            Transferir a otra cuenta
          </Button>
        ) : onTransfer && !reclaimable ? (
          <p
            className={
              mobile
                ? "text-[11px] leading-4 text-[#7a736a]"
                : "max-w-[12rem] px-2 text-[10px] leading-3.5 text-[#7a736a]"
            }
          >
            Sin cupo para sacar. Para meter saldo: Transferí desde otra cuenta
            con disponible (elegí esta como destino) o Asigná desde cartera.
          </p>
        ) : null}

        {reclaimable ? (
          <>
            <Button
              className={
                mobile
                  ? "h-11 w-full rounded-lg border border-[#c45a18] bg-white text-[13px] font-semibold text-[#c45a18] hover:bg-[#fff7f2]"
                  : "font-semibold text-[#8a8178]"
              }
              variant={mobile ? undefined : "ghost"}
              size={mobile ? undefined : "sm"}
              onClick={() => runReclaim(account)}
            >
              Recuperar a cartera
            </Button>
            <p
              className={
                mobile
                  ? "text-[11px] leading-4 text-[#7a736a]"
                  : "max-w-[11rem] px-2 text-[10px] leading-3.5 text-[#7a736a]"
              }
            >
              {transferable
                ? clientSelfService
                  ? "Pasalo a otra cuenta sin escribirnos."
                  : "O pasá directo a otra cuenta sin pasar por cartera."
                : "Cuenta suspendida. Jalá el saldo a cartera; después sale de Pagos."}
            </p>
          </>
        ) : (
          <Button
            className={
              mobile
                ? "h-11 w-full rounded-lg bg-[#e85a1c] text-[13px] font-semibold hover:bg-[#d14e16]"
                : "font-semibold text-[#c45a18]"
            }
            variant={mobile ? undefined : "ghost"}
            size={mobile ? undefined : "sm"}
            disabled={loadingAccountId === account.id}
            onClick={() => runAllocate(account)}
          >
            {loadingAccountId === account.id
              ? actionLoading
              : mobile
                ? actionLabelLong
                : actionLabel}
          </Button>
        )}

        {onEditTikTokIds ? (
          <button
            type="button"
            className={
              mobile
                ? "w-full text-center text-[12px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
                : "px-2 text-[11px] font-medium text-[#8a8178] underline-offset-2 hover:text-[#c45a18] hover:underline"
            }
            onClick={() => onEditTikTokIds(account)}
          >
            Cambiar ID TikTok
          </button>
        ) : null}
      </div>
    );
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
              className={
                isReclaimableSuspended(account)
                  ? "rounded-xl border border-[#f0c4a8] bg-[linear-gradient(180deg,#fff8f2_0%,#fffcf8_100%)] p-4"
                  : "rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-4 transition-colors hover:bg-[#faf7f3]"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                    {account.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {account.bmLabel ? (
                      <span className="rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af] ring-1 ring-[#c7d7fe]">
                        {account.bmLabel}
                      </span>
                    ) : null}
                    <p className="truncate font-mono text-[10px] text-[#9a9187]">
                      adv{" "}
                      {account.externalAccountId?.trim() || "— sin TikTok ID —"}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={statusBadgeClass(account.status)}>
                      {mapAdAccountStatusLabel(account.status)}
                    </span>
                    {!agencyBmFunding ? (
                      <span
                        className={
                          account.autoRecharge
                            ? "rounded bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#1f5c40]"
                            : "rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b645c]"
                        }
                      >
                        {account.autoRecharge ? "Auto on" : "Auto off"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">{renderBalanceCell(account, true)}</div>
              </div>
              {!agencyBmFunding && account.thresholdInfo ? (
                <p className="mt-2 truncate text-[11px] text-[#9a9187]">
                  {account.thresholdInfo}
                </p>
              ) : null}
              {renderActions(account, true)}
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
                  {balanceColumnLabel}
                </TableHead>
                {!agencyBmFunding ? (
                  <>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                      Recarga
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                      Umbral
                    </TableHead>
                  </>
                ) : null}
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className={
                    isReclaimableSuspended(account)
                      ? "border-b border-[#f0d9c4] bg-[#fff8f2] transition-colors hover:bg-[#fff3e8]"
                      : "border-b border-[rgb(20_18_16_/_0.05)] transition-colors hover:bg-[#faf7f3]"
                  }
                >
                  <TableCell className="text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                    <div className="min-w-0">
                      <p className="truncate">{account.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {account.bmLabel ? (
                          <span className="rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af] ring-1 ring-[#c7d7fe]">
                            {account.bmLabel}
                          </span>
                        ) : null}
                        <p className="truncate font-mono text-[10px] font-normal text-[#9a9187]">
                          adv{" "}
                          {account.externalAccountId?.trim() ||
                            "— sin TikTok ID —"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={statusBadgeClass(account.status)}>
                      {mapAdAccountStatusLabel(account.status)}
                    </span>
                  </TableCell>
                  <TableCell>{renderBalanceCell(account)}</TableCell>
                  {!agencyBmFunding ? (
                    <>
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
                    </>
                  ) : null}
                  <TableCell>{renderActions(account, false)}</TableCell>
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
