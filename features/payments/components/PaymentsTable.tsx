"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
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
}

interface AllocationResponse {
  ok: boolean;
  ledgerJournalId: string;
}

export function PaymentsTable({ accounts, onAllocate }: PaymentsTableProps) {
  const router = useRouter();
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;

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
          className={`mx-4 mb-3 rounded-xl border px-4 py-3 text-sm ${
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
        <div className="space-y-3 p-4 md:hidden">
          {accounts.map((account) => (
            <article
              key={account.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--foreground)]">
                    {account.name}
                  </p>
                  <div className="mt-1.5">
                    <Badge variant="warning">
                      {mapAdAccountStatusLabel(account.status)}
                    </Badge>
                  </div>
                </div>
                <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                  {formatMoney(account.balance)}
                </p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <dt className="text-[var(--admin-text-soft,#94a3b8)]">
                    Recarga auto
                  </dt>
                  <dd
                    className={
                      account.autoRecharge
                        ? "font-medium text-emerald-600"
                        : "font-medium text-[var(--admin-text-muted,#64748b)]"
                    }
                  >
                    {account.autoRecharge ? "Activada" : "Desactivada"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--admin-text-soft,#94a3b8)]">Umbral</dt>
                  <dd className="font-medium text-[var(--admin-text-muted,#64748b)]">
                    {account.thresholdInfo}
                  </dd>
                </div>
              </dl>
              <Button
                className="mt-4 h-11 w-full rounded-xl bg-[var(--brand-primary)] text-[14px] font-semibold hover:bg-[var(--brand-primary-deep)]"
                disabled={loadingAccountId === account.id}
                onClick={() => runAllocate(account)}
              >
                {loadingAccountId === account.id ? "Asignando…" : "Asignar saldo"}
              </Button>
            </article>
          ))}
        </div>
      ) : null}

      {!isEmpty ? (
        <div className="hidden md:block">
          <Table embedded className="rounded-none">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Cuenta publicitaria</TableHead>
                <TableHead>Estado de la cuenta publicitaria</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Recarga automática</TableHead>
                <TableHead>Información de umbral</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium text-[var(--foreground)]">
                    {account.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="warning">
                      {mapAdAccountStatusLabel(account.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatMoney(account.balance)}</TableCell>
                  <TableCell>
                    <span
                      className={
                        account.autoRecharge
                          ? "text-emerald-600"
                          : "text-[var(--admin-text-muted,#64748b)]"
                      }
                    >
                      {account.autoRecharge ? "Activada" : "Desactivada"}
                    </span>
                  </TableCell>
                  <TableCell className="text-[var(--admin-text-muted,#64748b)]">
                    {account.thresholdInfo}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--brand-primary)]"
                      disabled={loadingAccountId === account.id}
                      onClick={() => runAllocate(account)}
                    >
                      {loadingAccountId === account.id ? "Asignando…" : "Asignar"}
                    </Button>
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
