import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format-money";
import type { Wallet } from "@/types/wallet";

interface WalletCardProps {
  wallet: Wallet;
}

export function WalletCard({ wallet }: WalletCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-500">
          {wallet.name}
        </CardTitle>
      </CardHeader>
      <p className="text-2xl font-bold text-slate-900">
        {formatMoney(wallet.balance, wallet.currency)}
      </p>
      <p className="mt-1 text-xs text-slate-400">Saldo disponible</p>
    </Card>
  );
}
