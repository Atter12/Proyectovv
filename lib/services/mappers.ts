import type { TransactionHistoryItem } from "@/types/payment";
import type {
  DbTransactionStatus,
  DbWalletTransactionRow,
  DbWalletTransactionType,
} from "@/types/database";

export function centsToAmount(cents: number): number {
  return Number(cents) / 100;
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

const TX_TYPE_LABELS: Record<DbWalletTransactionType, string> = {
  deposit: "Depósito a cartera",
  withdrawal: "Retiro de cartera",
  allocation: "Asignación a cuenta publicitaria",
  refund: "Reembolso",
  adjustment: "Ajuste de saldo",
};

export function mapWalletTransactionRow(
  row: DbWalletTransactionRow,
): TransactionHistoryItem {
  return {
    id: row.id,
    date: row.created_at,
    description: row.description ?? TX_TYPE_LABELS[row.type] ?? row.type,
    amount: centsToAmount(row.amount_cents),
    currency: row.currency,
    status: row.status,
  };
}

export function mapTransactionStatusLabel(status: DbTransactionStatus): string {
  switch (status) {
    case "completed":
      return "Completado";
    case "pending":
      return "Pendiente";
    case "failed":
      return "Fallido";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

export function formatIsoDate(value: string | null): string | null {
  if (!value) return null;
  return value;
}
