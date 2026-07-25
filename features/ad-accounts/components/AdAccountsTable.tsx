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
  /** Hecom-scoped accounts: view only (no configure / archive in Ecomdy). */
  readOnly?: boolean;
}

export function AdAccountsTable({
  accounts,
  readOnly = false,
}: AdAccountsTableProps) {
  const router = useRouter();
  const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = accounts.length === 0;

  async function runAccountAction(
    account: AdAccount,
    action: "disable" | "reactivate" | "archive",
  ) {
    setLoadingActionId(`${account.id}:${action}`);
    setError(null);
    setMessage(null);
    try {
      await apiClient(`/api/ad-accounts/${account.id}/${action}`, {
        method: "POST",
      });
      setMessage(
        action === "archive"
          ? "Cuenta archivada."
          : action === "disable"
            ? "Cuenta desactivada."
            : "Cuenta reactivada.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo ejecutar la acción.",
      );
    } finally {
      setLoadingActionId(null);
    }
  }

  function AccountActions({
    account,
    compact = false,
  }: {
    account: AdAccount;
    compact?: boolean;
  }) {
    if (readOnly) {
      return (
        <p
          className={
            compact
              ? "text-center text-[12px] text-[var(--admin-text-muted,#64748b)]"
              : "text-[12px] text-[var(--admin-text-muted,#64748b)]"
          }
        >
          Solo lectura · Hecom
        </p>
      );
    }

    return (
      <div className={compact ? "flex flex-col gap-2" : "flex flex-wrap gap-1.5"}>
        <Button
          variant={compact ? undefined : "ghost"}
          size="sm"
          className={
            compact
              ? "h-11 w-full rounded-xl bg-[var(--brand-primary)] text-[14px] font-semibold hover:bg-[var(--brand-primary-deep)]"
              : "text-[var(--brand-primary)]"
          }
          onClick={() => setSelectedAccount(account)}
        >
          Configurar
        </Button>
        <div className={compact ? "grid grid-cols-2 gap-2" : "contents"}>
          {account.status === "active" ? (
            <Button
              variant="ghost"
              size="sm"
              className={compact ? "h-10 rounded-xl border border-[var(--border-subtle)]" : undefined}
              disabled={loadingActionId === `${account.id}:disable`}
              onClick={() => runAccountAction(account, "disable")}
            >
              Desactivar
            </Button>
          ) : account.status !== "archived" ? (
            <Button
              variant="ghost"
              size="sm"
              className={compact ? "h-10 rounded-xl border border-[var(--border-subtle)]" : undefined}
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
              className={compact ? "h-10 rounded-xl border border-[var(--border-subtle)]" : undefined}
              disabled={loadingActionId === `${account.id}:archive`}
              onClick={() => runAccountAction(account, "archive")}
            >
              Archivar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={compact ? "h-10 rounded-xl border border-[var(--border-subtle)]" : undefined}
              disabled={loadingActionId === `${account.id}:reactivate`}
              onClick={() => runAccountAction(account, "reactivate")}
            >
              Restaurar
            </Button>
          )}
        </div>
      </div>
    );
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
                  {account.externalAccountName ? (
                    <p className="mt-0.5 truncate text-[12px] text-[var(--admin-text-muted,#64748b)]">
                      {account.externalAccountName}
                    </p>
                  ) : null}
                  <div className="mt-2">
                    <Badge variant={statusVariants[account.status]}>
                      {statusLabels[account.status]}
                    </Badge>
                  </div>
                </div>
                <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                  {formatMoney(account.balance)}
                </p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <dt className="text-[var(--admin-text-soft,#94a3b8)]">Tipo</dt>
                  <dd className="font-medium text-[var(--admin-text-muted,#64748b)]">
                    {account.connectionLabel}
                  </dd>
                </div>
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
                  <dt className="text-[var(--admin-text-soft,#94a3b8)]">
                    Diario / mensual
                  </dt>
                  <dd className="font-medium text-[var(--admin-text-muted,#64748b)]">
                    {formatMoney(account.dailyBudget)} /{" "}
                    {formatMoney(account.monthlyLimit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--admin-text-soft,#94a3b8)]">Huso</dt>
                  <dd className="font-medium text-[var(--admin-text-muted,#64748b)]">
                    {account.timezone || "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <AccountActions account={account} compact />
              </div>
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
                  <TableCell className="font-medium text-[var(--foreground)]">
                    <div>{account.name}</div>
                    {account.externalAccountName ? (
                      <div className="text-xs font-normal text-[var(--admin-text-muted,#64748b)]">
                        {account.externalAccountName}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--admin-text-muted,#64748b)]">
                    {account.connectionLabel}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--admin-text-muted,#64748b)]">
                    {account.bcId}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[account.status]}>
                      {statusLabels[account.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-[var(--admin-text-muted,#64748b)]">
                    <div>Diario: {formatMoney(account.dailyBudget)}</div>
                    <div>Mensual: {formatMoney(account.monthlyLimit)}</div>
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
                    <div className="text-xs text-[var(--admin-text-muted,#64748b)]">
                      {account.thresholdInfo}
                    </div>
                  </TableCell>
                  <TableCell className="text-[var(--admin-text-muted,#64748b)]">
                    {account.timezone}
                  </TableCell>
                  <TableCell>
                    <AccountActions account={account} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {isEmpty && !readOnly ? <AdAccountsEmptyState /> : null}
      {isEmpty && readOnly ? (
        <div className="px-6 py-10 text-center text-sm text-[var(--admin-text-muted,#64748b)]">
          No hay cuentas para este filtro.
        </div>
      ) : null}
      {selectedAccount && !readOnly ? (
        <ConfigureAdAccountModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      ) : null}
    </div>
  );
}
