import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";
import { TechloButton } from "./TechloButton";

const COLUMNS = [
  {
    title: "Producto",
    links: [
      { label: "Soluciones", href: "#soluciones" },
      { label: "Proceso", href: "#proceso" },
      { label: "Herramientas", href: "#herramientas" },
      { label: "Opiniones", href: "#opiniones" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { label: "Entrar al panel", href: routes.login },
      { label: "Recuperar acceso", href: routes.forgotPassword },
    ],
  },
  {
    title: "Operación",
    links: [
      { label: "Pagos y cartera", href: routes.payments },
      { label: "Cuentas ads", href: routes.adAccounts },
    ],
  },
] as const;

const TAGS = ["TikTok Ads", "Cartera Holistic", "Hecom Club", "Latam"];

export function TechloFooter() {
  return (
    <footer className="tl-footer px-4 sm:px-6">
      {/* CTA band */}
      <div className="tl-container flex flex-col items-start gap-8 py-16 md:flex-row md:items-center md:justify-between md:py-20">
        <div>
          <p className="tl-eyebrow">{siteConfig.name}</p>
          <h2 className="tl-display mt-3 max-w-xl text-[clamp(1.6rem,1.1rem+2vw,2.6rem)]">
            ¿Listo para operar tus ads con control real?
          </h2>
        </div>
        <TechloButton href={routes.login} label="Entrar al panel" />
      </div>

      <div className="tl-container tl-footer-divider border-t" />

      {/* Brand + columns */}
      <div className="tl-container grid gap-12 py-14 md:grid-cols-[1.3fr_2fr]">
        <div>
          <AuthBrandMark
            tone="light"
            compact
            className="!justify-start max-w-[150px]"
          />
          <p className="mt-5 max-w-xs text-[0.95rem] leading-7 text-[var(--tl-muted)]">
            Panel Holistic Marketing — cartera, cuentas TikTok y pagos en un
            solo lugar para agencias y equipos de performance.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--tl-border)] bg-white px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--tl-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.14em] text-[var(--tl-muted)]">
                {column.title}
              </p>
              <ul className="mt-5 space-y-3 text-[0.95rem] font-medium">
                {column.links.map((link) =>
                  link.href.startsWith("#") ? (
                    <li key={link.label}>
                      <a href={link.href} className="tl-footer-link">
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link href={link.href} className="tl-footer-link">
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="tl-container tl-footer-divider flex flex-col gap-3 border-t py-7 text-[0.85rem] text-[var(--tl-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {siteConfig.companyName}. Todos los
          derechos reservados.
        </p>
        <p>
          Hecho para equipos de performance en{" "}
          <span className="font-semibold text-[var(--tl-primary)]">Latam</span>
        </p>
      </div>
    </footer>
  );
}
