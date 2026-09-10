"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { PaymentsEmptyState } from "./PaymentsEmptyState";
import { PaymentsAccountBalanceCell } from "./PaymentsAccountBalanceCell.client";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import type { AdAccountStatus } from "@/types/ad-account";
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

const STATUS_KEYS = new Set<AdAccountStatus>([
  "active",
  "pending",
  "disabled",
  "review",
  "archived",
]);

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
  const t = useTranslations("payments");
  const tAd = useTranslations("adAccounts");
  const { formatMoney } = useAppFormatter();
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;
  const actionLabel = agencyBmFunding
    ? t("assignmentTable.reload")
    : t("assignmentTable.assign");
  const actionLabelLong = agencyBmFunding
    ? t("assignmentTable.reloadBalance")
    : t("assignmentTable.assignBalance");
  const actionLoading = agencyBmFunding ? "Recargando…" : "Asignando…";
  const balanceColumnLabel = agencyBmFunding
    ? t("assignmentTable.tiktokLive")
    : t("assignmentTable.balanceQuota");

  function statusLabel(status: string): string {
    if (STATUS_KEYS.has(status as AdAccountStatus)) {
      return tAd(`status.${status as AdAccountStatus}`);
    }
    return status;
  }

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
            {t("assignmentTable.transfer")}
          </Button>
        ) : onTransfer && !reclaimable ? (
          <p
            className={
              mobile
                ? "text-[11px] leading-4 text-[#7a736a]"
                : "max-w-[13rem] text-[10px] leading-[1.45] text-[#7a736a]"
            }
          >
            Sin saldo para retirar. Asígnale desde la cartera, o transfiérele
            saldo desde otra cuenta eligiendo esta como destino.
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
              {t("assignmentTable.reclaim")}
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
                  ? "Transfiérelo a otra cuenta sin contactar con soporte."
                  : "También puedes transferirlo directamente a otra cuenta sin pasar por la cartera."
                : "Cuenta suspendida. Recupera el saldo en la cartera; después desaparecerá de Pagos."}
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
            {t("assignmentTable.editTikTokId")}
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
                      {account.externalAccountId?.trim() ||
                        t("assignmentTable.noTikTokId")}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={statusBadgeClass(account.status)}>
                      {statusLabel(account.status)}
                    </span>
                    {!agencyBmFunding ? (
                      <span
                        className={
                          account.autoRecharge
                            ? "rounded bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#1f5c40]"
                            : "rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b645c]"
                        }
                      >
                        {account.autoRecharge
                          ? t("assignmentTable.autoDebitOn")
                          : t("assignmentTable.autoDebitOff")}
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
        <div className="hidden md:block">
          <Table embedded className="rounded-none">
            <TableHeader>
              <TableRow className="border-b border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3] hover:bg-[#faf7f3]">
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  {t("assignmentTable.account")}
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  {t("assignmentTable.status")}
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  {balanceColumnLabel}
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                  {t("assignmentTable.action")}
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
                            t("assignmentTable.noTikTokId")}
                        </p>
                      </div>
                      {!agencyBmFunding ? (
                        <p className="mt-1 text-[10px] font-normal text-[#8a8178]">
                          {account.autoRecharge
                            ? t("assignmentTable.autoDebitOn")
                            : t("assignmentTable.autoDebitOff")}
                          {account.thresholdInfo
                            ? ` · ${account.thresholdInfo}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={statusBadgeClass(account.status)}>
                      {statusLabel(account.status)}
                    </span>
                  </TableCell>
                  <TableCell>{renderBalanceCell(account)}</TableCell>
                  <TableCell className="w-[15rem] whitespace-normal align-top sm:whitespace-normal">
                    {renderActions(account, false)}
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
