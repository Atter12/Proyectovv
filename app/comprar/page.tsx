import type { Metadata } from "next";
import { PublicLegalShell } from "@/features/legal/PublicLegalShell";
import { ShopCatalog } from "@/features/shop/ShopCatalog.client";
import { legalCompany } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Comprar recarga · Holistic Marketing",
  description: "Compra recarga de saldo publicitario para tu cartera Holistic.",
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
