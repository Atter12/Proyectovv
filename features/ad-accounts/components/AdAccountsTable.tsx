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

const statusStyles: Record<AdAccountStatus, string> = {
  active: "bg-[#ecf7f0] text-[#1f5c40] ring-[#c5e4d2]",
  pending: "bg-[#fff7eb] text-[#92400e] ring-[#f0d9b0]",
  disabled: "bg-[#f3eee8] text-[#5c564e] ring-[#e4ddd4]",
  review: "bg-[#f0f4f8] text-[#334e68] ring-[#d3dde8]",
  archived: "bg-[#f3eee8] text-[#7a736a] ring-[#e4ddd4]",
};

const statusDot: Record<AdAccountStatus, string> = {
  active: "bg-[#2f7a57]",
  pending: "bg-[#d97706]",
  disabled: "bg-[#8a8178]",
  review: "bg-[#486581]",
  archived: "bg-[#a39a90]",
};

function StatusPill({ status }: { status: AdAccountStatus }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium ring-1 ring-inset ${statusStyles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
      {statusLabels[status]}
    </span>
  );
}

function PlatformMark({ platform }: { platform: AdAccount["platform"] }) {
  if (platform === "tiktok") {
    return (
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[9px] font-bold tracking-wide text-white"
        title="TikTok"
      >
        <span className="text-[#25f4ee]">T</span>
        <span className="text-[#fe2c55]">T</span>
      </span>
    );
  }
  if (platform === "meta") {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#1877f2] text-[10px] font-bold text-white">
        M
      </span>
    );
  }
  if (platform === "google") {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#f3eee8] text-[10px] font-bold text-[#5c564e] ring-1 ring-[#e4ddd4]">
        G
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#f3eee8] text-[10px] font-bold text-[#5c564e] ring-1 ring-[#e4ddd4]">
      Ad
    </span>
  );
}

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
              ? "text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[#9a9187]"
              : "text-[11px] font-medium uppercase tracking-[0.08em] text-[#9a9187]"
          }
        >
          Solo lectura
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
              className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <PlatformMark platform={account.platform} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1a1612]">
                      {account.name}
                    </p>
                    {account.externalAccountName ? (
                      <p className="mt-0.5 truncate text-[12px] text-[#7a736a]">
                        {account.externalAccountName}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <StatusPill status={account.status} />
                    </div>
                  </div>
                </div>
                <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[#1a1612]">
                  {formatMoney(account.balance)}
                </p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[rgb(20_18_16_/_0.06)] pt-3 text-[12px]">
                <div>
                  <dt className="text-[#9a9187]">Tipo</dt>
                  <dd className="font-medium text-[#5c564e]">
                    {account.connectionLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#9a9187]">Recarga auto</dt>
                  <dd
                    className={
                      account.autoRecharge
                        ? "font-medium text-[#1f5c40]"
                        : "font-medium text-[#5c564e]"
                    }
                  >
                    {account.autoRecharge ? "Activada" : "Desactivada"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#9a9187]">Diario / mensual</dt>
                  <dd className="font-medium tabular-nums text-[#5c564e]">
                    {formatMoney(account.dailyBudget)} /{" "}
                    {formatMoney(account.monthlyLimit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#9a9187]">Huso</dt>
                  <dd className="font-medium text-[#5c564e]">
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
              <TableRow className="border-b border-[rgb(20_18_16_/_0.07)] bg-[#f6f0e8] hover:bg-[#f6f0e8]">
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  Cuenta
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  Tipo
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  Estado
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  Presupuestos
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  Saldo
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  Recarga
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  Huso
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a736a]">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className="border-b border-[rgb(20_18_16_/_0.05)] hover:bg-[#faf7f3]"
                >
                  <TableCell className="font-medium text-[#1a1612]">
                    <div className="flex items-start gap-2.5">
                      <PlatformMark platform={account.platform} />
                      <div className="min-w-0">
                        <div className="truncate">{account.name}</div>
                        {account.externalAccountName ? (
                          <div className="truncate text-xs font-normal text-[#7a736a]">
                            {account.externalAccountName}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-[#5c564e]">
                    {account.connectionLabel}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-[#7a736a]">
                    {account.bcId}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={account.status} />
                  </TableCell>
                  <TableCell className="text-[12px] tabular-nums text-[#5c564e]">
                    <div>Diario: {formatMoney(account.dailyBudget)}</div>
                    <div className="text-[#9a9187]">
                      Mensual: {formatMoney(account.monthlyLimit)}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums text-[#1a1612]">
                    {formatMoney(account.balance)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        account.autoRecharge
                          ? "text-[13px] font-medium text-[#1f5c40]"
                          : "text-[13px] text-[#7a736a]"
                      }
                    >
                      {account.autoRecharge ? "Activada" : "Desactivada"}
                    </span>
                    <div className="text-[11px] text-[#9a9187]">
                      {account.thresholdInfo}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-[#5c564e]">
                    {account.timezone || "—"}
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
        <div className="px-6 py-12 text-center">
          <p className="text-[14px] font-medium text-[#1a1612]">
            Ninguna cuenta coincide con el filtro
          </p>
          <p className="mt-1 text-[13px] text-[#7a736a]">
            Probá otro estado o limpiá la búsqueda.
          </p>
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
