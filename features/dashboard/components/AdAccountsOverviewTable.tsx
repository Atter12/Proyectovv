import Link from "next/link";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatMoney } from "@/lib/format-money";
import { routes } from "@/config/routes";
import type { AdAccount } from "@/types/ad-account";

const overviewColumns = [
  "Cuenta publicitaria",
  "Costo",
  "Saldo",
  "CPC",
  "CPM",
  "Impresiones",
  "Clics",
  "CTR",
  "Huso horario",
];

interface AdAccountsOverviewTableProps {
  accounts: AdAccount[];
}

export function AdAccountsOverviewTable({ accounts }: AdAccountsOverviewTableProps) {
  const isEmpty = accounts.length === 0;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-[1.1rem] font-medium tracking-tight text-[var(--foreground)]">
            Cuentas publicitarias
          </h2>
          <p className="mt-0.5 text-[14px] text-[var(--admin-text-muted,#64748b)]">
            Administra tus cuentas, saldo y métricas principales.
          </p>
        </div>
        <Link
          href={routes.adAccounts}
          className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--brand-primary-deep)] sm:h-9 sm:w-auto"
        >
          Ver / crear cuentas
        </Link>
      </div>

      {!isEmpty ? (
        <div className="space-y-3 p-4 md:hidden">
          {accounts.map((account) => (
            <article
              key={account.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--foreground)]">
                    {account.name}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--admin-text-muted,#64748b)]">
                    {account.timezone || "Sin huso horario"}
                  </p>
                </div>
                <p className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
                  {formatMoney(account.balance)}
                </p>
              </div>
              <Link
                href={routes.adAccounts}
                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--surface-soft)]"
              >
                Abrir cuentas
              </Link>
            </article>
          ))}
        </div>
      ) : null}

      {!isEmpty ? (
        <div className="hidden md:block">
          <Table embedded className="rounded-none border-0 shadow-none">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {overviewColumns.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-[var(--surface-soft)]/80">
                  <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                    {account.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-text-muted,#64748b)]">—</td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-text-muted,#64748b)]">
                    {formatMoney(account.balance)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-text-muted,#64748b)]">—</td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-text-muted,#64748b)]">—</td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-text-muted,#64748b)]">—</td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-text-muted,#64748b)]">—</td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-text-muted,#64748b)]">—</td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-text-muted,#64748b)]">
                    {account.timezone || "—"}
                  </td>
                </tr>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {isEmpty && (
        <EmptyState
          title="No hay datos"
          description="Crea tu primera cuenta publicitaria para empezar a publicar."
          className="min-h-[200px] py-10"
          action={
            <Link
              href={routes.adAccounts}
              className="mt-4 inline-flex h-9 items-center rounded-xl bg-[var(--brand-primary)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--brand-primary-deep)]"
            >
              Crear cuenta publicitaria
            </Link>
          }
        />
      )}
    </div>
  );
}
