export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  created: "Creado",
  requires_payment: "Requiere pago",
  processing: "Procesando",
  succeeded: "Aprobado",
  failed: "Rechazado",
  cancelled: "Cancelado",
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  pending: "Pendiente",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export const AD_ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  pending: "Pendiente",
  disabled: "Desactivada",
  review: "En revisión",
};

export function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (["succeeded", "completed", "active", "resolved", "matched", "processed"].includes(status)) {
    return "success";
  }
  if (["failed", "cancelled", "closed", "disabled", "amount_mismatch", "currency_mismatch"].includes(status)) {
    return "danger";
  }
  if (["pending", "requires_payment", "processing", "queued", "running", "received", "review"].includes(status)) {
    return "warning";
  }
  if (["open", "created", "converted"].includes(status)) {
    return "info";
  }
  return "neutral";
}
