"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
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
import { AdAccountLiveBalanceCell } from "./AdAccountLiveBalanceCell.client";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { buildGastosUrlForAdvertiser } from "@/lib/hecom/gastos-url";
import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const statusLabels: Record<AdAccountStatus, string> = {
  active: "Activa",
  pending: "Pendiente",
  disabled: "Suspendida",
  review: "En revisión",
  archived: "Archivada",
};

const statusStyles: Record<AdAccountStatus, string> = {
  active: "bg-[#ecf7f0] text-[#1f5c40] ring-[#c5e4d2]",
  pending: "bg-[#fff7eb] text-[#92400e] ring-[#f0d9b0]",
  disabled: "bg-[#fdeceb] text-[#9b2c2c] ring-[#f0c4c4]",
  review: "bg-[#f0f4f8] text-[#334e68] ring-[#d3dde8]",
  archived: "bg-[#f3eee8] text-[#7a736a] ring-[#e4ddd4]",
};

const statusDot: Record<AdAccountStatus, string> = {
  active: "bg-[#2f7a57]",
  pending: "bg-[#d97706]",
  disabled: "bg-[#c53030]",
  review: "bg-[#486581]",
  archived: "bg-[#a39a90]",
};

function StatusPill({ status }: { status: AdAccountStatus }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
      {statusLabels[status]}
    </span>
  );
}

function MetaChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "fee" | "mono";
}) {
  const cls =
    tone === "fee"
      ? "bg-[#fff1e8] font-semibold text-[#c45a18]"
      : tone === "mono"
        ? "bg-[#f3eee8] font-mono text-[#6b645c]"
        : "bg-[#f3eee8] font-medium text-[#6b645c]";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${cls}`}>{children}</span>
  );
}

function PlatformMark({ platform }: { platform: AdAccount["platform"] }) {
  if (platform === "tiktok") {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold tracking-wide text-white"
        title="TikTok"
      >
        <span className="text-[#25f4ee]">T</span>
        <span className="text-[#fe2c55]">T</span>
      </span>
    );
  }
  if (platform === "meta") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1877f2] text-[9px] font-bold text-white">
        M
      </span>
    );
  }
  if (platform === "google") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f3eee8] text-[9px] font-bold text-[#5c564e] ring-1 ring-[#e4ddd4]">
        G
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f3eee8] text-[9px] font-bold text-[#5c564e] ring-1 ring-[#e4ddd4]">
      Ad
    </span>
  );
}

function shortId(id: string | null | undefined) {
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function parseAccountDisplay(account: AdAccount) {
  const raw = (account.name || account.externalAccountName || "Cuenta").trim();
  const match = raw.match(/^(.*?)\s+(\d+(?:\.\d+)?\s*USD)\s*[-–]\s*(.+)$/i);
  const title = match ? match[1].trim() : raw;
  const balanceHint = match ? match[2].replace(/\s+/g, " ").trim() : null;
  const tag = match ? match[3].trim() : null;

  const secondaryRaw = account.externalAccountName?.trim() ?? "";
  const secondaryDistinct =
    Boolean(secondaryRaw) &&
    secondaryRaw.toLowerCase() !== raw.toLowerCase() &&
    secondaryRaw.toLowerCase() !== title.toLowerCase();

  const feeMatch = account.thresholdInfo?.match(/(\d+(?:\.\d+)?)\s*%/);
  const fee = feeMatch ? feeMatch[1] : null;
  const bm =
    account.externalBusinessId ||
    (account.bcId && account.bcId !== account.externalAccountId
      ? account.bcId
      : null);

  return {
    title,
    tag,
    balanceHint: balanceHint && account.balance === 0 ? balanceHint : null,
    secondary: secondaryDistinct ? secondaryRaw : null,
    accountId: account.externalAccountId || account.bcId,
    fee,
    bm: bm ? (String(bm).startsWith("BM") ? String(bm) : `BM ${bm}`) : null,
  };
}

function Head({ children }: { children: ReactNode }) {
  return (
    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
      {children}
    </TableHead>
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
  // Siempre: saldo TikTok en vivo (cliente y gerente). Antes solo readOnly.
  const live = useAdAccountLiveMetrics(true);
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

  function GastosLinkButton({
    account,
    compact = false,
  }: {
    account: AdAccount;
    compact?: boolean;
  }) {
    const advertiserId = account.externalAccountId?.trim();
    if (!advertiserId) return null;
    const bm =
      account.externalBusinessId?.replace(/^BM\s*/i, "") ??
      account.bcId?.replace(/^BM\s*/i, "") ??
      null;
    const href = buildGastosUrlForAdvertiser({
      advertiserId,
      bmBucket: bm,
      days: 14,
    });
    return (
      <Link
        href={href}
        className={
          compact
            ? "inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#e85a1c]/30 bg-[#fff7f0] px-3 text-[12px] font-semibold text-[#c45a18] transition hover:bg-[#fff1e8]"
            : "inline-flex h-8 items-center rounded-lg border border-[#e85a1c]/30 bg-[#fff7f0] px-3 text-[12px] font-semibold text-[#c45a18] transition hover:bg-[#fff1e8]"
        }
      >
        Ver gastos
      </Link>
    );
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
        <div className={compact ? "flex flex-col gap-2" : "flex flex-col items-start gap-2"}>
          <GastosLinkButton account={account} compact={compact} />
          <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-[#9a9187]">
            Actualiza cada {live.pollSeconds}s
          </p>
        </div>
      );
    }

    return (
      <div className={compact ? "flex flex-col gap-2" : "flex flex-wrap gap-1.5"}>
        <Button
          variant={compact ? undefined : "ghost"}
          size="sm"
          className={
            compact
              ? "h-11 w-full rounded-lg bg-[#e85a1c] text-[13px] font-medium hover:bg-[#d14e16]"
              : "text-[#c45a18]"
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
              className={
                compact
                  ? "h-10 rounded-lg border border-[rgb(20_18_16_/_0.1)]"
                  : undefined
              }
              disabled={loadingActionId === `${account.id}:disable`}
              onClick={() => runAccountAction(account, "disable")}
            >
              Desactivar
            </Button>
          ) : account.status !== "archived" ? (
            <Button
              variant="ghost"
              size="sm"
              className={
                compact
                  ? "h-10 rounded-lg border border-[rgb(20_18_16_/_0.1)]"
                  : undefined
              }
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
              className={
                compact
                  ? "h-10 rounded-lg border border-[rgb(20_18_16_/_0.1)]"
                  : undefined
              }
              disabled={loadingActionId === `${account.id}:archive`}
              onClick={() => runAccountAction(account, "archive")}
            >
              Archivar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={
                compact
                  ? "h-10 rounded-lg border border-[rgb(20_18_16_/_0.1)]"
                  : undefined
              }
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

  function AccountCell({ account }: { account: AdAccount }) {
    const display = parseAccountDisplay(account);
    return (
      <div className="flex min-w-0 items-start gap-2.5">
        <PlatformMark platform={account.platform} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612]">
            {display.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {display.tag ? <MetaChip>{display.tag}</MetaChip> : null}
            {display.balanceHint ? (
              <MetaChip tone="fee">{display.balanceHint}</MetaChip>
            ) : null}
            {display.secondary ? (
              <span className="truncate text-[11px] text-[#9a9187]">
                {display.secondary}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {readOnly && !isEmpty ? (
        <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgb(20_18_16_/_0.08)] bg-[#fffaf5] px-4 py-3 text-[12px] text-[#5c564e]">
          <p>
            <span className="font-semibold text-[#1a1612]">Saldo en vivo TikTok</span>
            {" · "}
            se actualiza automáticamente cada {live.pollSeconds} segundos.
          </p>
          {live.error ? (
            <span className="text-[11px] font-medium text-red-600">{live.error}</span>
          ) : (
            <button
              type="button"
              onClick={() => void live.refresh()}
              className="text-[11px] font-semibold text-[#c45a18] hover:underline"
            >
              Actualizar ahora
            </button>
          )}
        </div>
      ) : null}

      {(message || error) && (
        <div
          className={`mx-4 mb-3 rounded-lg border px-4 py-3 text-[13px] ${
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
          {accounts.map((account) => {
            const display = parseAccountDisplay(account);
            return (
              <article
                key={account.id}
                className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-4 transition-colors hover:bg-[#faf7f3]"
              >
                <div className="flex items-start justify-between gap-3">
                  <AccountCell account={account} />
                  <StatusPill status={account.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[rgb(20_18_16_/_0.06)] pt-3">
                  <MetaChip tone="mono">{shortId(display.accountId)}</MetaChip>
                  {display.bm ? <MetaChip>{display.bm}</MetaChip> : null}
                  {display.fee ? (
                    <MetaChip tone="fee">Fee {display.fee}%</MetaChip>
                  ) : (
                    <MetaChip>{account.thresholdInfo}</MetaChip>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-[12px]">
                  {readOnly ? (
                    <div>
                      <dt className="text-[#9a9187]">Saldo TikTok en vivo</dt>
                      <dd>
                        <AdAccountLiveBalanceCell
                          advertiserId={account.externalAccountId}
                          metric={
                            account.externalAccountId
                              ? live.metricsByAdvertiser[account.externalAccountId]
                              : undefined
                          }
                          loading={live.loading}
                        />
                      </dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt className="text-[#9a9187]">Saldo</dt>
                        <dd className="tabular-nums text-[#1a1612]">
                          {formatMoney(account.balance)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#9a9187]">Huso</dt>
                        <dd className="text-[#5c564e]">
                          {account.timezone || "—"}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                <div className="mt-3">
                  <AccountActions account={account} compact />
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!isEmpty ? (
        <div className="hidden md:block overflow-x-auto">
          <Table embedded className="rounded-none">
            <TableHeader>
              <TableRow className="border-b border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3] hover:bg-[#faf7f3]">
                <Head>Cuenta</Head>
                <Head>ID</Head>
                <Head>Estado</Head>
                {readOnly ? (
                  <>
                    <Head>Saldo en vivo</Head>
                    <Head>Fee</Head>
                  </>
                ) : (
                  <>
                    <Head>Presupuestos</Head>
                    <Head>Saldo</Head>
                    <Head>Recarga</Head>
                  </>
                )}
                {!readOnly ? <Head>Huso</Head> : null}
                <Head>Acción</Head>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const display = parseAccountDisplay(account);
                return (
                  <TableRow
                    key={account.id}
                    className="border-b border-[rgb(20_18_16_/_0.05)] transition-colors hover:bg-[#faf7f3]"
                  >
                    <TableCell className="max-w-[280px]">
                      <AccountCell account={account} />
                    </TableCell>
                    <TableCell title={display.accountId ?? undefined}>
                      <div className="flex flex-wrap gap-1.5">
                        <MetaChip tone="mono">
                          {shortId(display.accountId)}
                        </MetaChip>
                        {display.bm ? <MetaChip>{display.bm}</MetaChip> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={account.status} />
                    </TableCell>
                    {readOnly ? (
                      <>
                        <TableCell>
                          <AdAccountLiveBalanceCell
                            advertiserId={account.externalAccountId}
                            metric={
                              account.externalAccountId
                                ? live.metricsByAdvertiser[account.externalAccountId]
                                : undefined
                            }
                            loading={live.loading}
                          />
                        </TableCell>
                        <TableCell>
                          {display.fee ? (
                            <MetaChip tone="fee">Fee {display.fee}%</MetaChip>
                          ) : (
                            <span className="text-[12px] text-[#5c564e]">
                              {account.thresholdInfo}
                            </span>
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-[12px] tabular-nums text-[#5c564e]">
                          <div>Diario: {formatMoney(account.dailyBudget)}</div>
                          <div className="text-[#9a9187]">
                            Mensual: {formatMoney(account.monthlyLimit)}
                          </div>
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
                          <div className="mt-1">
                            {display.fee ? (
                              <MetaChip tone="fee">Fee {display.fee}%</MetaChip>
                            ) : (
                              <span className="text-[11px] text-[#9a9187]">
                                {account.thresholdInfo}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </>
                    )}
                    {!readOnly ? (
                      <TableCell className="text-[12px] text-[#5c564e]">
                        {account.timezone || "—"}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <AccountActions account={account} />
                    </TableCell>
                  </TableRow>
                );
              })}
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
