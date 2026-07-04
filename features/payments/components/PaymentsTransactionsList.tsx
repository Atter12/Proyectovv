import { formatMoney } from "@/lib/format-money";
import type { TransactionHistoryItem } from "@/types/payment";

interface PaymentsTransactionsListProps {
  transactions: TransactionHistoryItem[];
}

export function PaymentsTransactionsList({
  transactions,
}: PaymentsTransactionsListProps) {
  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#e5e7eb] bg-slate-50/80 text-left text-xs uppercase tracking-wide text-[#64748b]">
            <th className="px-4 py-3 font-medium sm:px-6">Fecha</th>
            <th className="px-4 py-3 font-medium sm:px-6">Descripción</th>
            <th className="px-4 py-3 font-medium sm:px-6">Monto</th>
            <th className="px-4 py-3 font-medium sm:px-6">Estado</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b border-[#e5e7eb] last:border-0">
              <td className="px-4 py-3 text-[#64748b] sm:px-6">{tx.date}</td>
              <td className="px-4 py-3 text-[#0f172a] sm:px-6">{tx.description}</td>
              <td className="px-4 py-3 font-medium text-[#0f172a] sm:px-6">
                {formatMoney(tx.amount, tx.currency)}
              </td>
              <td className="px-4 py-3 capitalize text-[#64748b] sm:px-6">
                {tx.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
