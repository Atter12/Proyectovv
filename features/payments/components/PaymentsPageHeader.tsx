import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";

export function PaymentsPageHeader() {
  return (
    <DashboardPageIntro
      description="Gestiona saldo, métodos de pago y asignaciones desde tu cartera central."
      badges={
        <Badge variant="info" className="px-3 py-1">
          Datos de ejemplo
        </Badge>
      }
    />
  );
}
