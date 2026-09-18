import type { Metadata } from "next";
import { PublicLegalShell } from "@/features/legal/PublicLegalShell";
import { ShopCart } from "@/features/shop/ShopCart.client";

export const metadata: Metadata = {
  title: "Carrito · Holistic Marketing",
  description: "Carrito de recarga de saldo publicitario.",
};

export default function CartPage() {
  return (
    <PublicLegalShell title="Carrito">
      <ShopCart />
    </PublicLegalShell>
  );
}
