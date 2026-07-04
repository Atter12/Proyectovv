import type { AdAccountStatus } from "@/types/ad-account";
import { mapTransactionStatusLabel } from "@/lib/services/mappers";

export const AD_ACCOUNT_STATUS_LABELS: Record<AdAccountStatus, string> = {
  active: "Activa",
  pending: "Pendiente",
  disabled: "Desactivada",
  review: "En revisión",
};

export function mapAdAccountStatusLabel(status: string): string {
  return (
    AD_ACCOUNT_STATUS_LABELS[status as AdAccountStatus] ?? status
  );
}

export { mapTransactionStatusLabel };
