import { Card } from "@/components/ui/Card";
import { InfoAlert } from "@/components/feedback/InfoAlert";
import { AdAccountsToolbar } from "@/features/ad-accounts/components/AdAccountsToolbar.client";
import { getAdAccounts } from "@/services/ad-accounts.mock.service";

export default async function AdAccountsPage() {
  const accounts = await getAdAccounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Mis cuentas publicitarias
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Administra tus cuentas conectadas o creadas dentro del panel
        </p>
      </div>

      <InfoAlert title="Información importante">
        Las cuentas publicitarias requieren saldo asignado desde Cartera Default
        para activar campañas. Crea una cuenta y asigna presupuesto desde Pago.
      </InfoAlert>

      <Card>
        <AdAccountsToolbar accounts={accounts} />
      </Card>
    </div>
  );
}
