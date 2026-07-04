import { Badge } from "@/components/ui/Badge";

export function PaymentsPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="max-w-2xl text-sm leading-relaxed text-[#64748b]">
          Gestiona saldo, métodos de pago y asignaciones desde tu cartera central.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Badge variant="info" className="px-3 py-1">
          Datos de ejemplo
        </Badge>
      </div>
    </div>
  );
}
