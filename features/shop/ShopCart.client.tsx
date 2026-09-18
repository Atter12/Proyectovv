"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { routes } from "@/config/routes";
import {
  cartTotal,
  readCart,
  setLineQty,
  type CartLine,
  SHOP_CART_EVENT,
} from "@/lib/shop/cart";

export function ShopCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    const sync = () => setLines(readCart());
    sync();
    window.addEventListener(SHOP_CART_EVENT, sync);
    return () => window.removeEventListener(SHOP_CART_EVENT, sync);
  }, []);

  const total = cartTotal(lines);

  if (lines.length === 0) {
    return (
      <p>
        El carrito está vacío.{" "}
        <Link href={routes.shop} className="font-semibold underline">
          Ver recargas
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-4"
          >
            <div>
              <p className="font-semibold">{line.name}</p>
              <p className="text-[13px] text-[#5c5854]">{line.detail}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-black/15"
                onClick={() => setLines(setLineQty(line.id, line.qty - 1))}
                aria-label="Quitar uno"
              >
                −
              </button>
              <span className="w-6 text-center tabular-nums">{line.qty}</span>
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-black/15"
                onClick={() => setLines(setLineQty(line.id, line.qty + 1))}
                aria-label="Agregar uno"
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[1.15rem] font-semibold tabular-nums">Total USD {total}</p>
      <p className="text-[13px] text-[#5c5854]">
        Al pagar aceptas los{" "}
        <Link href={routes.terms} className="underline">
          términos
        </Link>{" "}
        y la{" "}
        <Link href={routes.returns} className="underline">
          política de devoluciones
        </Link>
        . El cobro se completa en el panel, con tu cuenta.
      </p>
      <Link
        href={`${routes.login}?next=${encodeURIComponent(routes.payments)}`}
        className="inline-flex h-11 items-center rounded-full bg-[#ff781f] px-5 text-[14px] font-bold text-white"
      >
        Pagar ahora
      </Link>
    </div>
  );
}
