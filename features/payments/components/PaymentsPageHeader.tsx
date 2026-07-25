import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";
import { PaymentsOpenAddBalanceButton } from "./PaymentsOpenAddBalanceButton.client";

export function PaymentsPageHeader() {
  return (
    <DashboardPageIntro
      description="Gestiona saldo, métodos de pago y asignaciones desde tu cartera central."
      badges={
        <Badge variant="info" className="px-3 py-1">
          Datos de ejemplo
        </Badge>
      }
      actions={
        <PaymentsOpenAddBalanceButton className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)] sm:h-10 sm:w-auto">
          Agregar saldo
        </PaymentsOpenAddBalanceButton>
      }
    />
  );
}
