import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";

export function TechloFooter() {
  return (
    <footer className="bg-[var(--tl-theme-dark)] px-4 py-14 text-white sm:px-6">
      <div className="tl-container grid gap-10 md:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="brightness-0 invert">
            <AuthBrandMark
              tone="light"
              compact
              className="!justify-start max-w-[140px]"
            />
          </div>
          <p className="mt-4 max-w-xs text-[0.95rem] leading-7 text-[var(--tl-light)]">
            Panel Holistic Marketing — cartera, TikTok Ads y operación Hecom
            Club en Latam.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/45">
              Producto
            </p>
            <ul className="mt-4 space-y-2.5 text-[0.95rem] text-[var(--tl-light)]">
              <li>
                <a href="#soluciones" className="hover:text-white">
                  Soluciones
                </a>
              </li>
              <li>
                <a href="#proceso" className="hover:text-white">
                  Proceso
                </a>
              </li>
              <li>
                <a href="#herramientas" className="hover:text-white">
                  Herramientas
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/45">
              Cuenta
            </p>
            <ul className="mt-4 space-y-2.5 text-[0.95rem] text-[var(--tl-light)]">
              <li>
                <Link href={routes.login} className="hover:text-white">
                  Entrar
                </Link>
              </li>
              <li>
                <Link href={routes.forgotPassword} className="hover:text-white">
                  Recuperar acceso
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/45">
              Operación
            </p>
            <ul className="mt-4 space-y-2.5 text-[0.95rem] text-[var(--tl-light)]">
              <li>
                <Link href={routes.payments} className="hover:text-white">
                  Pagos
                </Link>
              </li>
              <li>
                <Link href={routes.adAccounts} className="hover:text-white">
                  Cuentas ads
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="tl-container mt-12 border-t border-white/10 pt-6 text-[0.85rem] text-white/45">
        © {new Date().getFullYear()} {siteConfig.companyName}
      </div>
    </footer>
  );
}
