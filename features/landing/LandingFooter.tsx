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
    <footer className="border-t border-[var(--auth-divider)] bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="flex justify-start">
            <AuthBrandMark tone="light" compact className="!justify-start max-w-[150px]" />
          </div>
          <p className="mt-4 max-w-xs text-[14px] leading-6 text-[var(--auth-text-muted)]">
            {siteConfig.description}
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
              {column.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[14px] font-semibold text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-[1180px] flex-col gap-2 border-t border-[var(--auth-divider)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] font-medium text-[var(--auth-text-soft)]">
          © {new Date().getFullYear()} {siteConfig.companyName}
        </p>
        <p className="text-[13px] font-medium text-[var(--auth-text-soft)]">
          Panel para anunciantes · Latam
        </p>
      </div>
    </footer>
  );
}
