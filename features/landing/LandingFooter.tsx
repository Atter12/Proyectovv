import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";

const COLUMNS = [
  {
    title: "Producto",
    links: [
      { href: "#soluciones", label: "Soluciones" },
      { href: "#como-funciona", label: "Cómo funciona" },
      { href: "#herramientas", label: "Herramientas" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: routes.login, label: "Entrar" },
      { href: routes.forgotPassword, label: "Recuperar acceso" },
    ],
  },
  {
    title: "Operación",
    links: [
      { href: routes.overview, label: "Panel" },
      { href: routes.payments, label: "Pagos" },
      { href: routes.adAccounts, label: "Cuentas ads" },
    ],
  },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--landing-hairline)] bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto grid w-full max-w-[72rem] gap-10 md:grid-cols-[1.15fr_2fr]">
        <div>
          <AuthBrandMark
            tone="light"
            compact
            className="!justify-start max-w-[140px] sm:max-w-[150px]"
          />
          <p className="mt-4 max-w-xs text-[0.98rem] leading-[1.7] text-[var(--landing-body)]">
            Panel Holistic Marketing — cartera, TikTok Ads y operación Hecom
            Club en Latam.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="landing-label !text-[var(--landing-muted)]">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-register text-[0.9375rem] font-medium text-[var(--landing-body)] transition-colors hover:text-[var(--landing-accent-text)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 flex w-full max-w-[72rem] flex-col items-center gap-2 border-t border-[var(--landing-hairline)] pt-8 text-center">
        <div
          aria-hidden
          className="mb-2 h-1.5 w-1.5 rounded-full bg-[var(--landing-accent)] opacity-70"
        />
        <p className="font-register text-[0.8125rem] font-medium text-[var(--landing-muted)]">
          © {new Date().getFullYear()} {siteConfig.companyName}
        </p>
        <p className="max-w-md font-[family-name:var(--font-literata)] text-[0.9rem] italic text-[var(--landing-soft)]">
          Alegreya Sans · Literata · Holistic orange
        </p>
      </div>
    </footer>
  );
}
