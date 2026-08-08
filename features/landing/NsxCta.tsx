import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";
import { NsxBtnPrimary, NsxBtnSecondary } from "./NsxButtons";
import { NsxReveal } from "./NsxReveal.client";

export function NsxCta() {
  return (
    <section className="nsx-section border-t border-[var(--nsx-stroke)] bg-white">
      <div className="nsx-container">
        <div className="mx-auto max-w-[40rem] space-y-6 text-center">
          <NsxReveal delayMs={40}>
            <span className="nsx-badge">Empezá hoy</span>
          </NsxReveal>
          <NsxReveal delayMs={100}>
            <h2 className="nsx-h2">Entrá a tu panel Holistic</h2>
          </NsxReveal>
          <NsxReveal delayMs={150}>
            <p className="text-[var(--nsx-muted)]">
              Unite a +180 equipos que ya centralizan cartera, cuentas TikTok y
              pagos Hecom. Creá tu cuenta u operá con tu email de siempre.
            </p>
          </NsxReveal>
          <NsxReveal delayMs={200}>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <NsxBtnPrimary href={routes.register}>Crear cuenta</NsxBtnPrimary>
              <NsxBtnSecondary href={routes.login}>
                Ya tengo cuenta
              </NsxBtnSecondary>
            </div>
          </NsxReveal>
        </div>
      </div>
    </section>
  );
}

export function NsxFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="nsx-footer">
      <div className="nsx-container flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <HolisticLogo size={140} className="h-9 w-auto max-w-[140px] object-contain" />
          <span className="hidden rounded-full bg-[#fff1e8] px-2.5 py-0.5 text-[11px] font-semibold text-[#c2410c] sm:inline">
            Ads + Hecom
          </span>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-[var(--nsx-muted)]">
          <Link href={routes.login} className="hover:text-[var(--nsx-secondary)]">
            Entrar
          </Link>
          <Link
            href={routes.register}
            className="hover:text-[var(--nsx-secondary)]"
          >
            Registro
          </Link>
          <a href="#soluciones" className="hover:text-[var(--nsx-secondary)]">
            Soluciones
          </a>
        </div>
        <p className="text-xs text-[var(--nsx-muted)]">
          © {year} {siteConfig.companyName}. Cartera, TikTok y operación Hecom.
        </p>
      </div>
    </footer>
  );
}
