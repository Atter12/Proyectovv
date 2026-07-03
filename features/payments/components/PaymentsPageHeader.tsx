import { Badge } from "@/components/ui/Badge";
import type { PaymentOverview } from "@/types/payment";

interface PaymentsPageHeaderProps {
  data: PaymentOverview;
}

export function PaymentsPageHeader({ data }: PaymentsPageHeaderProps) {
  const hasTransactions =
    data.accountTransactions.length > 0 ||
    data.walletTransactions.length > 0 ||
    data.refunds.length > 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-[#0f172a] sm:text-2xl">
          Pago
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#64748b]">
          Gestiona saldo, métodos de pago y asignaciones desde tu cartera central.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Badge variant="info" className="px-3 py-1">
          Modo mock
        </Badge>
        {!hasTransactions && (
          <Badge variant="default" className="px-3 py-1">
            Sin transacciones
          </Badge>
        )}
      </div>
    </div>
  );
}
