import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatMoney } from "@/lib/format-money";
import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const statusLabels: Record<AdAccountStatus, string> = {
  active: "Activa",
  pending: "Pendiente",
  suspended: "Suspendida",
  inactive: "Inactiva",
};

const statusVariants: Record<AdAccountStatus, "success" | "warning" | "default" | "info"> = {
  active: "success",
  pending: "warning",
  suspended: "default",
  inactive: "info",
};

interface AdAccountsTableProps {
  accounts: AdAccount[];
  showEmpty?: boolean;
}

export function AdAccountsTable({ accounts, showEmpty = true }: AdAccountsTableProps) {
  if (accounts.length === 0 && showEmpty) {
    return <EmptyState />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cuenta publicitaria</TableHead>
          <TableHead>Tu identificación de BC</TableHead>
          <TableHead>Estado de la cuenta publicitaria</TableHead>
          <TableHead>Costo</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Recarga automática</TableHead>
          <TableHead>Información de umbral</TableHead>
          <TableHead>Huso horario</TableHead>
          <TableHead>Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id}>
            <TableCell className="font-medium text-slate-900">
              {account.name}
            </TableCell>
            <TableCell>{account.bcId}</TableCell>
            <TableCell>
              <Badge variant={statusVariants[account.status]}>
                {statusLabels[account.status]}
              </Badge>
            </TableCell>
            <TableCell>{formatMoney(account.cost)}</TableCell>
            <TableCell>{formatMoney(account.balance)}</TableCell>
            <TableCell>{account.autoRecharge ? "Sí" : "No"}</TableCell>
            <TableCell>{account.thresholdInfo}</TableCell>
            <TableCell>{account.timezone}</TableCell>
            <TableCell>
              <Button variant="ghost" size="sm">
                Gestionar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
