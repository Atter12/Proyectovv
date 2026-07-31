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
      { href: routes.login, label: "Iniciar sesión" },
      { href: routes.register, label: "Crear cuenta" },
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
    <footer className="border-t border-[var(--auth-divider)] bg-white px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1180px] gap-8 sm:gap-10 md:grid-cols-[1.15fr_2fr]">
        <div>
          <div className="flex justify-start">
            <AuthBrandMark tone="light" compact className="!justify-start max-w-[140px] sm:max-w-[150px]" />
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-6 text-[var(--auth-text-muted)] sm:mt-4 sm:text-[14px]">
            {siteConfig.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)] sm:text-[12px]">
                {column.title}
              </p>
              <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)] sm:text-[14px]"
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

      <div className="mx-auto mt-8 flex w-full max-w-[1180px] flex-col gap-1.5 border-t border-[var(--auth-divider)] pt-5 sm:mt-10 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
        <p className="text-[12px] font-medium text-[var(--auth-text-soft)] sm:text-[13px]">
          © {new Date().getFullYear()} {siteConfig.companyName}
        </p>
        <p className="text-[12px] font-medium text-[var(--auth-text-soft)] sm:text-[13px]">
          Panel para anunciantes · Latam
        </p>
      </div>
    </footer>
  );
}
