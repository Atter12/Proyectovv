import Link from "next/link";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
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
      <div className="flex flex-col gap-3 border-b border-[#e5e7eb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#0f172a]">
            Cuentas publicitarias
          </h2>
          <p className="mt-0.5 text-sm text-[#64748b]">
            Administra tus cuentas, saldo y métricas principales.
          </p>
        </div>
        <Link
          href={routes.adAccounts}
          className="inline-flex h-9 shrink-0 items-center rounded-xl border border-[#dbe1ea] bg-white px-4 text-sm font-medium text-[#0f172a] transition-all duration-200 hover:bg-slate-50 hover:shadow-sm"
        >
          Crear nueva
        </Link>
      </div>

      <Table className="rounded-none border-0 shadow-none">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {overviewColumns.map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isEmpty &&
            accounts.map((account) => (
              <tr key={account.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {account.name}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">—</td>
                <td className="px-4 py-3 text-sm text-slate-700">—</td>
                <td className="px-4 py-3 text-sm text-slate-700">—</td>
                <td className="px-4 py-3 text-sm text-slate-700">—</td>
                <td className="px-4 py-3 text-sm text-slate-700">—</td>
                <td className="px-4 py-3 text-sm text-slate-700">—</td>
                <td className="px-4 py-3 text-sm text-slate-700">—</td>
                <td className="px-4 py-3 text-sm text-slate-700">{account.timezone || "—"}</td>
              </tr>
            ))}
        </TableBody>
      </Table>

      {isEmpty && (
        <EmptyState
          title="No hay datos"
          description="Crea tu primera cuenta publicitaria para empezar a publicar."
          className="min-h-[200px] py-10"
          action={
            <Link
              href={routes.adAccounts}
              className="mt-4 inline-flex h-9 items-center rounded-xl border border-[#dbe1ea] bg-white px-4 text-sm font-medium text-[#4056ff] transition-all duration-200 hover:bg-[#4056ff]/5"
            >
              Crear cuenta publicitaria
            </Link>
          }
        />
      )}
    </div>
  );
}
