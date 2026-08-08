import Link from "next/link";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";

export function NsxCta() {
  return (
    <section className="nsx-cta" aria-labelledby="cta-title">
      <div className="nsx-container nsx-cta-inner">
        <div>
          <span className="nsx-pill nsx-pill-on-dark">Acceso</span>
          <h2 className="nsx-h2 nsx-h2-on-dark" id="cta-title">
            Todo el control de cartera y TikTok, en un solo panel
          </h2>
          <p>
            Un único acceso para clientes, managers y admin. Sin fricción extra:
            entra y opera con la cuenta que te dio {siteConfig.name}.
          </p>
        </div>
        <Link href={routes.login} className="nsx-btn-light">
          Entrar
          <span className="nsx-btn-arrow" aria-hidden>
            →
          </span>
        </Link>
      </div>
    </section>
  );
}

export function NsxFooter() {
  return (
    <footer className="nsx-footer">
      <div className="nsx-container nsx-footer-row">
        <div className="nsx-footer-brand">
          <strong>{siteConfig.name}</strong>
          <span>Cartera, TikTok Ads y operación Hecom Club</span>
        </div>
        <nav className="nsx-footer-nav" aria-label="Pie de página">
          <a href="#soluciones">Soluciones</a>
          <a href="#proceso">Proceso</a>
          <a href="#nosotros">Nosotros</a>
          <a href="#producto">Producto</a>
          <a href="#resultados">Resultados</a>
          <Link href={routes.login}>Entrar</Link>
        </nav>
        <p className="nsx-footer-copy">
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
      </div>
    </footer>
  );
}
