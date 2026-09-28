import Link from "next/link";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";
import type { LandingCopy } from "./i18n/landing-copy";

export function NsxCta({ copy }: { copy: LandingCopy["cta"] }) {
  return (
    <section className="nsx-cta" aria-labelledby="cta-title">
      <div className="nsx-container nsx-cta-inner">
        <div>
          <span className="nsx-pill nsx-pill-on-dark">{copy.pill}</span>
          <h2 className="nsx-h2 nsx-h2-on-dark" id="cta-title">
            {copy.title}
          </h2>
          <p>{copy.lead}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={routes.register} className="nsx-btn-light">
            {copy.register}
            <span className="nsx-btn-arrow" aria-hidden>
              →
            </span>
          </Link>
          <Link href={routes.login} className="nsx-btn-outline">
            {copy.login}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function NsxFooter({ copy }: { copy: LandingCopy["footer"] }) {
  return (
    <footer className="nsx-footer">
      <div className="nsx-container nsx-footer-row">
        <div className="nsx-footer-brand">
          <strong>{siteConfig.name}</strong>
          <span>{copy.tagline}</span>
        </div>
        <nav className="nsx-footer-nav" aria-label={copy.ariaNav}>
          <a href="#soluciones">{copy.solutions}</a>
          <Link href={routes.shop}>{copy.buy}</Link>
          <Link href={routes.cart}>{copy.cart}</Link>
          <Link href={routes.terms}>{copy.terms}</Link>
          <Link href={routes.returns}>{copy.returns}</Link>
          <Link href={routes.complaints}>{copy.complaints}</Link>
          <Link href={routes.login}>{copy.login}</Link>
          <Link href={routes.register}>{copy.register}</Link>
        </nav>
        <p className="nsx-footer-copy">
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
      </div>
    </footer>
  );
}
