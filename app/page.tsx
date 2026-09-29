import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { absoluteUrl, seoConfig } from "@/config/seo";
import { getSession } from "@/lib/auth/session.server";
import { LandingPage } from "@/features/landing/LandingPage";
import { getLandingCopy } from "@/features/landing/i18n/landing-copy";
import {
  landingLocaleQueryParam,
  type LandingLocale,
} from "@/features/landing/i18n/landing-locale";
import { getLandingLocale } from "@/features/landing/i18n/landing-locale.server";
import type { Metadata } from "next";
import "@/features/landing/automation-landing.css";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** URL canónica de cada idioma: español en `/`, el resto con `?lang=`. */
const LOCALE_PATHS: Record<LandingLocale, string> = {
  es: "/",
  en: `/?${landingLocaleQueryParam}=en`,
  zh: `/?${landingLocaleQueryParam}=zh`,
};

const OG_LOCALES: Record<LandingLocale, string> = {
  es: "es_PE",
  en: "en_US",
  zh: "zh_CN",
};

export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const locale = await getLandingLocale((await searchParams)[landingLocaleQueryParam]);
  const copy = getLandingCopy(locale);

  return {
    title: { absolute: copy.meta.title },
    description: copy.meta.description,
    keywords: locale === "es" ? [...seoConfig.keywords] : undefined,
    alternates: {
      canonical: LOCALE_PATHS[locale],
      languages: {
        "es-PE": LOCALE_PATHS.es,
        en: LOCALE_PATHS.en,
        "zh-CN": LOCALE_PATHS.zh,
        "x-default": LOCALE_PATHS.es,
      },
    },
    openGraph: {
      type: "website",
      url: LOCALE_PATHS[locale],
      siteName: seoConfig.siteName,
      title: copy.meta.title,
      description: copy.meta.description,
      locale: OG_LOCALES[locale],
      alternateLocale: Object.values(OG_LOCALES).filter((l) => l !== OG_LOCALES[locale]),
      images: [{ url: seoConfig.ogImagePath, width: 1600, height: 1000, alt: copy.hero.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.meta.title,
      description: copy.meta.description,
      images: [seoConfig.ogImagePath],
    },
  };
}

/** Datos estructurados (schema.org) para que Google entienda quiénes somos. */
function buildJsonLd(locale: LandingLocale) {
  const copy = getLandingCopy(locale);
  const orgId = absoluteUrl("/#organization");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: seoConfig.companyName,
        alternateName: seoConfig.siteName,
        url: absoluteUrl("/"),
        logo: absoluteUrl(seoConfig.logoPath),
        areaServed: "Worldwide",
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: seoConfig.siteName,
        url: absoluteUrl("/"),
        inLanguage: ["es-PE", "en", "zh-CN"],
        publisher: { "@id": orgId },
      },
      {
        "@type": "Service",
        name: copy.hero.eyebrow,
        serviceType: "TikTok Ads",
        description: copy.meta.description,
        provider: { "@id": orgId },
        areaServed: "Worldwide",
      },
      {
        "@type": "FAQPage",
        inLanguage: locale === "zh" ? "zh-CN" : locale === "es" ? "es-PE" : "en",
        mainEntity: copy.faq.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

export default async function HomePage({ searchParams }: HomeProps) {
  const session = await getSession();
  if (session) {
    redirect(routes.overview);
  }

  const locale = await getLandingLocale((await searchParams)[landingLocaleQueryParam]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildJsonLd(locale)).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage locale={locale} />
    </>
  );
}
