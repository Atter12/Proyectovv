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
import { mapAdAccountStatusLabel } from "@/lib/ui/labels";
import { PaymentsEmptyState } from "./PaymentsEmptyState";
import type { PaymentAccountAllocation } from "@/types/payment";

interface PaymentsTableProps {
  accounts: PaymentAccountAllocation[];
}

export function PaymentsTable({ accounts }: PaymentsTableProps) {
  const isEmpty = accounts.length === 0;

  return (
    <div>
      <Table className="rounded-none border-0 shadow-none">
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
                <Button variant="ghost" size="sm" className="text-[#4056ff]">
                  Asignar
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
