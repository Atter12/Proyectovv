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
import { formatMoney } from "@/lib/format-money";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { AdAccountsEmptyState } from "./AdAccountsEmptyState";
import { ConfigureAdAccountModal } from "./ConfigureAdAccountModal.client";
import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const statusLabels: Record<AdAccountStatus, string> = {
  active: "Activa",
  pending: "Pendiente",
  disabled: "Desactivada",
  review: "En revisión",
  archived: "Archivada",
};

const statusVariants: Record<
  AdAccountStatus,
  "success" | "warning" | "default" | "info"
> = {
  active: "success",
  pending: "warning",
  disabled: "default",
  review: "info",
  archived: "default",
};

interface AdAccountsTableProps {
  accounts: AdAccount[];
}

export function AdAccountsTable({ accounts }: AdAccountsTableProps) {
  const router = useRouter();
  const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;

  async function runAccountAction(account: AdAccount, action: "disable" | "reactivate" | "archive") {
    setLoadingActionId(`${account.id}:${action}`);
    setError(null);
    setMessage(null);
    try {
      await apiClient(`/api/ad-accounts/${account.id}/${action}`, { method: "POST" });
      setMessage(
        action === "archive"
          ? "Cuenta archivada."
          : action === "disable"
            ? "Cuenta desactivada."
            : "Cuenta reactivada.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "No se pudo ejecutar la acción.");
    } finally {
      setLoadingActionId(null);
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
            <TableHead>Tipo</TableHead>
            <TableHead>Identificación</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Presupuestos</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Recarga automática</TableHead>
            <TableHead>Huso horario</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium text-[#0f172a]">
                <div>{account.name}</div>
                {account.externalAccountName ? (
                  <div className="text-xs font-normal text-[#64748b]">{account.externalAccountName}</div>
                ) : null}
              </TableCell>
              <TableCell className="text-xs text-[#64748b]">{account.connectionLabel}</TableCell>
              <TableCell className="font-mono text-xs text-[#64748b]">{account.bcId}</TableCell>
              <TableCell>
                <Badge variant={statusVariants[account.status]}>
                  {statusLabels[account.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-[#64748b]">
                <div>Diario: {formatMoney(account.dailyBudget)}</div>
                <div>Mensual: {formatMoney(account.monthlyLimit)}</div>
              </TableCell>
              <TableCell>{formatMoney(account.balance)}</TableCell>
              <TableCell>
                <span className={account.autoRecharge ? "text-[#16a34a]" : "text-[#64748b]"}>
                  {account.autoRecharge ? "Activada" : "Desactivada"}
                </span>
                <div className="text-xs text-[#64748b]">{account.thresholdInfo}</div>
              </TableCell>
              <TableCell className="text-[#64748b]">{account.timezone}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="sm" className="text-[var(--brand-primary)]" onClick={() => setSelectedAccount(account)}>
                    Configurar
                  </Button>
                  {account.status === "active" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadingActionId === `${account.id}:disable`}
                      onClick={() => runAccountAction(account, "disable")}
                    >
                      Desactivar
                    </Button>
                  ) : account.status !== "archived" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadingActionId === `${account.id}:reactivate`}
                      onClick={() => runAccountAction(account, "reactivate")}
                    >
                      Reactivar
                    </Button>
                  ) : null}
                  {account.status !== "archived" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadingActionId === `${account.id}:archive`}
                      onClick={() => runAccountAction(account, "archive")}
                    >
                      Archivar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadingActionId === `${account.id}:reactivate`}
                      onClick={() => runAccountAction(account, "reactivate")}
                    >
                      Restaurar
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {isEmpty && <AdAccountsEmptyState />}
      {selectedAccount ? (
        <ConfigureAdAccountModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      ) : null}
    </div>
  );
}
