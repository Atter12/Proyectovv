import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format-money";

interface WalletBalancePanelProps {
  walletName: string;
  balance: number;
  currency: string;
}

export function WalletBalancePanel({
  walletName,
  balance,
  currency,
}: WalletBalancePanelProps) {
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{walletName}</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">
          {formatMoney(balance, currency)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline">Reembolso</Button>
        <Button>Agregar saldo</Button>
      </div>
    </Card>
  );
}
