import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AuthBrandMark } from "@/features/auth/components/AuthBrandMark";

const NAV = [
  { href: "#soluciones", label: "Soluciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#herramientas", label: "Herramientas" },
  { href: "#opiniones", label: "Opiniones" },
] as const;

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--auth-divider)] bg-[rgb(248_250_252_/_0.86)] backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] w-full max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={routes.home} aria-label={siteConfig.name} className="shrink-0">
          <AuthBrandMark tone="light" compact className="max-w-[160px]" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Principal">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={routes.login}
            className="hidden h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-white sm:inline-flex"
          >
            Iniciar sesión
          </Link>
          <Link
            href={routes.register}
            className="inline-flex h-10 items-center rounded-xl bg-[var(--auth-accent)] px-4 text-[14px] font-bold text-white shadow-[0_8px_18px_rgb(255_120_31_/_0.25)] transition-[filter] hover:brightness-[1.05]"
          >
            Empezar
          </Link>
        </div>
      </div>
    </header>
  );
}
