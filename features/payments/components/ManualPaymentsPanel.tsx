import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format-money";
import { getRecentManualPaymentIntents } from "@/services/payments.service";
import type { SessionUser } from "@/types/auth";

interface ManualPaymentsPanelProps {
  session: SessionUser;
}

const reviewLabels = {
  awaiting_proof: "Falta voucher",
  pending_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
} as const;

const reviewVariants = {
  awaiting_proof: "warning",
  pending_review: "info",
  approved: "success",
  rejected: "default",
  cancelled: "default",
} as const;

export async function ManualPaymentsPanel({ session }: ManualPaymentsPanelProps) {
  const intents = await getRecentManualPaymentIntents(session);

  if (intents.length === 0) return null;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-[#e5e7eb] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#0f172a]">
          Pagos manuales recientes
        </h2>
        <p className="mt-1 text-xs text-[#64748b]">
          Seguimiento del voucher y revisión operativa antes de acreditar saldo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-slate-50/80 text-left text-xs uppercase tracking-wide text-[#64748b]">
              <th className="px-4 py-3 font-medium sm:px-5">Fecha</th>
              <th className="px-4 py-3 font-medium sm:px-5">Monto</th>
              <th className="px-4 py-3 font-medium sm:px-5">Estado</th>
              <th className="px-4 py-3 font-medium sm:px-5">Voucher</th>
              <th className="px-4 py-3 font-medium sm:px-5">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {intents.map((intent) => (
              <tr key={intent.id} className="border-b border-[#e5e7eb] last:border-0">
                <td className="px-4 py-3 text-[#64748b] sm:px-5">
                  {new Date(intent.createdAt).toLocaleString("es-PE")}
                </td>
                <td className="px-4 py-3 font-semibold text-[#0f172a] sm:px-5">
                  {formatMoney(intent.amount, intent.currency)}
                </td>
                <td className="px-4 py-3 sm:px-5">
                  <Badge variant={reviewVariants[intent.reviewStatus]}>
                    {reviewLabels[intent.reviewStatus]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[#64748b] sm:px-5">
                  {intent.proofFileName ?? "Sin comprobante"}
                </td>
                <td className="max-w-[280px] px-4 py-3 text-[#64748b] sm:px-5">
                  {intent.failureReason ??
                    (intent.reviewStatus === "pending_review"
                      ? "Pendiente de aprobación en el futuro panel admin."
                      : "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
