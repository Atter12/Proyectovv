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
import { AdAccountsEmptyState } from "./AdAccountsEmptyState";
import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const statusLabels: Record<AdAccountStatus, string> = {
  active: "Activa",
  pending: "Pendiente",
  disabled: "Desactivada",
  review: "En revisión",
};

const statusVariants: Record<
  AdAccountStatus,
  "success" | "warning" | "default" | "info"
> = {
  active: "success",
  pending: "warning",
  disabled: "default",
  review: "info",
};

interface AdAccountsTableProps {
  accounts: AdAccount[];
}

export function AdAccountsTable({ accounts }: AdAccountsTableProps) {
  const isEmpty = accounts.length === 0;

  return (
    <div>
      <Table embedded className="rounded-none">
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead>Cuenta publicitaria</TableHead>
            <TableHead>Identificación de BC</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Costo</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Recarga automática</TableHead>
            <TableHead>Umbral</TableHead>
            <TableHead>Huso horario</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium text-[#0f172a]">
                {account.name}
              </TableCell>
              <TableCell className="font-mono text-xs text-[#64748b]">
                {account.bcId}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariants[account.status]}>
                  {statusLabels[account.status]}
                </Badge>
              </TableCell>
              <TableCell>{formatMoney(account.cost)}</TableCell>
              <TableCell>{formatMoney(account.balance)}</TableCell>
              <TableCell>
                <span
                  className={
                    account.autoRecharge
                      ? "text-[#16a34a]"
                      : "text-[#64748b]"
                  }
                >
                  {account.autoRecharge ? "Activada" : "Desactivada"}
                </span>
              </TableCell>
              <TableCell className="text-[#64748b]">
                {account.thresholdInfo}
              </TableCell>
              <TableCell className="text-[#64748b]">{account.timezone}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="text-[#4056ff]">
                  Configurar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {isEmpty && <AdAccountsEmptyState />}
    </div>
  );
}
