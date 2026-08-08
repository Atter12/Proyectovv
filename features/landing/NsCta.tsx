import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { NsReveal } from "./NsReveal.client";

export function NsCta() {
  return (
    <section className="ns-section border-t border-[var(--ns-stroke)]">
      <div className="ns-container">
        <div className="mx-auto max-w-[40rem] text-center">
          <NsReveal delayMs={40}>
            <span className="ns-badge mb-5">Empezá hoy</span>
          </NsReveal>
          <NsReveal delayMs={100}>
            <h2 className="ns-h2 mb-3">¿Listo para crecer con control?</h2>
          </NsReveal>
          <NsReveal delayMs={160}>
            <p className="mb-6 text-[var(--ns-muted)]">
              Hacé que cada dólar de media trabaje más claro. Creá tu cuenta y
              operá clientes, pagos y gasto diario en Holistic Marketing.
            </p>
          </NsReveal>
          <NsReveal delayMs={220}>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={routes.register}
                className="ns-btn ns-btn-md ns-btn-secondary"
              >
                Crear cuenta
              </Link>
              <Link
                href={routes.login}
                className="ns-btn ns-btn-md ns-btn-white"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </NsReveal>
        </div>
      </div>
    </section>
  );
}

export function NsFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--ns-stroke)] bg-[var(--ns-bg-1)] py-10">
      <div className="ns-container flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-[var(--ns-secondary)]">
            {siteConfig.name}
          </p>
          <p className="mt-1 text-sm text-[var(--ns-muted)]">
            Ads, cartera y operación Hecom en un solo lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-[var(--ns-muted)]">
          <Link href={routes.login} className="hover:text-[var(--ns-secondary)]">
            Entrar
          </Link>
          <Link
            href={routes.register}
            className="hover:text-[var(--ns-secondary)]"
          >
            Registro
          </Link>
          <a href="#servicios" className="hover:text-[var(--ns-secondary)]">
            Servicios
          </a>
        </div>
        <p className="text-xs text-[var(--ns-muted)]">
          © {year} {siteConfig.companyName}
        </p>
      </div>
    </footer>
  );
}
