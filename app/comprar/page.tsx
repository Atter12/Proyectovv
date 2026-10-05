import type { Metadata } from "next";
import { PublicLegalShell } from "@/features/legal/PublicLegalShell";
import { ShopCatalog } from "@/features/shop/ShopCatalog.client";
import { legalCompany } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Comprar saldo para TikTok Ads · Recarga desde USD 100 | Holistic Marketing",
  description:
    "Compra saldo publicitario para TikTok Ads en paquetes de USD 100, 300 o 500. Paga con billetera, cripto o transferencia y asígnalo a tus cuentas.",
  alternates: { canonical: "/comprar" },
};

export default function ShopPage() {
  return (
    <PublicLegalShell title="Comprar recarga">
      <p>
        {legalCompany.service} Elige un monto, agrégalo al carrito y paga. El
        precio de esta página es el saldo que entra a la cartera. La comisión
        del medio de pago, si aplica, se muestra otra vez antes de cobrar.
      </p>
      <ShopCatalog />
    </PublicLegalShell>
  );
}
