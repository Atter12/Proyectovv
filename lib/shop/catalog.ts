export type ShopProduct = {
  id: string;
  name: string;
  detail: string;
  priceUsd: number;
};

/** Producto visible en el sitio: recarga de cartera, no un bien físico. */
export const shopProducts: ShopProduct[] = [
  {
    id: "recarga-100",
    name: "Recarga de saldo publicitario",
    detail: "USD 100 a la cartera Holistic para asignar a TikTok.",
    priceUsd: 100,
  },
  {
    id: "recarga-300",
    name: "Recarga de saldo publicitario",
    detail: "USD 300 a la cartera Holistic para asignar a TikTok.",
    priceUsd: 300,
  },
  {
    id: "recarga-500",
    name: "Recarga de saldo publicitario",
    detail: "USD 500 a la cartera Holistic para asignar a TikTok.",
    priceUsd: 500,
  },
];

export function findShopProduct(id: string): ShopProduct | null {
  return shopProducts.find((item) => item.id === id) ?? null;
}
