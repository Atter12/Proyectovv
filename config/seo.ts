/** Dominio público para SEO (canonical, sitemap, Open Graph). */
const PRODUCTION_URL = "https://www.adsholistic.com";

function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  // En local el env apunta a localhost: para SEO siempre se usa el dominio real.
  if (!fromEnv || fromEnv.includes("localhost") || fromEnv.includes("127.0.0.1")) {
    return PRODUCTION_URL;
  }
  return fromEnv;
}

export const seoConfig = {
  siteUrl: resolveSiteUrl(),
  siteName: "Ads Holistic",
  companyName: "Holistic Marketing",
  logoPath: "/brand/holistic-marketing-logo.png",
  ogImagePath: "/landing/holistic/hero-dashboard.png",
  /** Palabras con las que nos buscan (también guían los textos visibles). */
  keywords: [
    "agencia de TikTok Ads",
    "agencia de publicidad digital",
    "agencia de marketing digital",
    "publicar anuncios en TikTok",
    "subir anuncios a TikTok",
    "cuentas publicitarias de TikTok",
    "recargar saldo TikTok Ads",
    "recarga TikTok Ads con Stripe",
    "pagar TikTok Ads con cripto",
    "Business Center TikTok",
    "píxel de TikTok",
    "anuncios contra entrega",
    "ROAS TikTok",
    "análisis de creativos con IA",
  ],
} as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, seoConfig.siteUrl).toString();
}
