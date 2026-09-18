import { findShopProduct } from "@/lib/shop/catalog";

export const SHOP_CART_KEY = "holistic-shop-cart";
export const SHOP_CART_EVENT = "holistic-shop-cart";

export type CartLine = {
  id: string;
  name: string;
  detail: string;
  priceUsd: number;
  qty: number;
};

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHOP_CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed) ? parsed.filter((line) => line.qty > 0) : [];
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  window.localStorage.setItem(SHOP_CART_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(SHOP_CART_EVENT));
}

export function addProductToCart(productId: string) {
  const product = findShopProduct(productId);
  if (!product) return readCart();
  const lines = readCart();
  const existing = lines.find((line) => line.id === product.id);
  if (existing) existing.qty += 1;
  else {
    lines.push({
      id: product.id,
      name: product.name,
      detail: product.detail,
      priceUsd: product.priceUsd,
      qty: 1,
    });
  }
  writeCart(lines);
  return lines;
}

export function setLineQty(productId: string, qty: number) {
  const lines = readCart()
    .map((line) =>
      line.id === productId ? { ...line, qty: Math.max(0, qty) } : line,
    )
    .filter((line) => line.qty > 0);
  writeCart(lines);
  return lines;
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export function cartTotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.priceUsd * line.qty, 0);
}
