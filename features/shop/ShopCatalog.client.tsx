"use client";

import { useState } from "react";
import Link from "next/link";
import { routes } from "@/config/routes";
import { shopProducts } from "@/lib/shop/catalog";
import { addProductToCart } from "@/lib/shop/cart";

export function ShopCatalog() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {shopProducts.map((product) => (
        <article
          key={product.id}
          className="rounded-2xl border border-black/10 bg-white p-4"
        >
          <p className="text-[16px] font-semibold">{product.name}</p>
          <p className="mt-1 text-[14px] text-[#5c5854]">{product.detail}</p>
          <p className="mt-2 text-[1.25rem] font-semibold tabular-nums">
            USD {product.priceUsd}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-full bg-[#ff781f] px-4 text-[13px] font-bold text-white"
              onClick={() => {
                addProductToCart(product.id);
                setNotice("Agregado al carrito.");
              }}
            >
              Agregar al carrito
            </button>
            <Link
              href={routes.cart}
              onClick={() => addProductToCart(product.id)}
              className="inline-flex h-10 items-center rounded-full border border-black/15 px-4 text-[13px] font-bold"
            >
              Comprar ahora
            </Link>
          </div>
        </article>
      ))}
      {notice ? (
        <p className="text-[13px] font-semibold text-[#1f5c40]">
          {notice}{" "}
          <Link href={routes.cart} className="underline">
            Ver carrito
          </Link>
        </p>
      ) : null}
    </div>
  );
}
