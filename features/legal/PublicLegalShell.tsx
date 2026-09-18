import Link from "next/link";
import type { ReactNode } from "react";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";
import { routes } from "@/config/routes";
import { legalCompany } from "@/lib/legal/company";
import { ShopCartLink } from "@/features/shop/ShopCartLink.client";

const LINKS = [
  { href: routes.shop, label: "Comprar" },
  { href: routes.cart, label: "Carrito" },
  { href: routes.terms, label: "Términos y condiciones" },
  { href: routes.returns, label: "Cambios y devoluciones" },
  { href: routes.complaints, label: "Libro de reclamaciones" },
] as const;

export function PublicLegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f4ef] text-[#1a1a1c]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href={routes.home} aria-label={legalCompany.tradeName}>
            <HolisticLogo size={140} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <ShopCartLink />
            <Link
              href={routes.shop}
              className="inline-flex h-9 items-center rounded-full bg-[#ff781f] px-3 text-[13px] font-bold text-white"
            >
              Comprar
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-[1.7rem] font-semibold tracking-[-0.03em]">{title}</h1>
        <div className="mt-5 space-y-4 text-[15px] leading-7 text-[#3a3836]">
          {children}
        </div>
      </main>
      <footer className="border-t border-black/10 bg-white">
        <nav className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-4 gap-y-2 px-4 py-5 text-[13px] font-semibold text-[#6b6560]">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-[#1a1a1c]">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mx-auto w-full max-w-3xl px-4 pb-6 text-[12px] text-[#6b6560]">
          {legalCompany.legalName} · RUC {legalCompany.ruc} · {legalCompany.city}
        </p>
      </footer>
    </div>
  );
}
