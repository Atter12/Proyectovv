import { Card } from "@/components/ui/Card";
import { WalletBalancePanel } from "@/features/payments/components/WalletBalancePanel";
import { PaymentGatewaySelector } from "@/features/payments/components/PaymentGatewaySelector.client";
import { PaymentTabs } from "@/features/payments/components/PaymentTabs.client";
import { getPaymentOverview } from "@/services/payments.mock.service";

export default async function PaymentsPage() {
  const data = await getPaymentOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pago</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestiona saldo, pasarelas de pago y transacciones
        </p>
      </div>

      <WalletBalancePanel
        walletName={data.wallet.name}
        balance={data.wallet.balance}
        currency={data.wallet.currency}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Método de pago
        </h2>
        <PaymentGatewaySelector gateways={data.gateways} />
      </div>

      <Card>
        <PaymentTabs data={data} />
      </Card>
    </div>
  );
}
