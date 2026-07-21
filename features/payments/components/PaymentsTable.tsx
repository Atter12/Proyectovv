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
              <TableCell className="font-medium text-[#0f172a]">
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
                    account.autoRecharge ? "text-[#16a34a]" : "text-[#64748b]"
                  }
                >
                  {account.autoRecharge ? "Activada" : "Desactivada"}
                </span>
              </TableCell>
              <TableCell className="text-[#64748b]">
                {account.thresholdInfo}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--brand-primary)]"
                  disabled={loadingAccountId === account.id}
                  onClick={() => (onAllocate ? onAllocate(account) : handleAllocate(account))}
                >
                  {loadingAccountId === account.id ? "Asignando…" : "Asignar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {isEmpty && <PaymentsEmptyState />}
    </div>
  );
}
