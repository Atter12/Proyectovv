import "./automation-landing.css";
import "./landing-sections.css";
import { NsxNav } from "./NsxNav.client";
import { NsxHero } from "./NsxHero.client";
import { NsxPayMarquee } from "./NsxPayMarquee";
import { NsxShowcase } from "./NsxShowcase.client";
import { NsxAiSpotlight } from "./NsxAiSpotlight";
import { NsxAbout } from "./NsxAbout";
import { NsxFeatures, NsxProcess } from "./NsxFeatures";
import { NsxFaq, NsxReferral } from "./NsxFaq";
import { NsxGallery } from "./NsxGallery";
import { NsxCta, NsxFooter } from "./NsxCta";
import { getLandingCopy } from "./i18n/landing-copy";
import { landingLocaleHtmlLang, type LandingLocale } from "./i18n/landing-locale";

/**
 * Landing principal — layout Automation SaaS (Nexsas template),
 * marca e info Holistic Marketing / Hecom.
 * Acceso público dual: Registrarme + Iniciar sesión.
 * Idioma propio (es/en/zh), independiente del i18n del dashboard.
 */
export function LandingPage({ locale }: { locale: LandingLocale }) {
  const copy = getLandingCopy(locale);

  return (
    <div
      lang={landingLocaleHtmlLang[locale]}
      className="nsx-landing relative min-h-screen overflow-x-hidden"
    >
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        {copy.skipToContent}
      </a>

      <NsxNav locale={locale} copy={copy.nav} />
      <main id="contenido">
        <NsxHero copy={copy.hero} nav={copy.nav} />
        <NsxPayMarquee copy={copy.payments} />
        <NsxShowcase copy={copy.showcase} />
        <NsxAiSpotlight copy={copy.ai} />
        <NsxProcess copy={copy.process} />
        <NsxFeatures copy={copy.extras} />
        <NsxReferral copy={copy.referral} />
        <NsxAbout copy={copy.about} />
        <NsxGallery copy={copy.gallery} />
        <NsxFaq copy={copy.faq} />
        <NsxCta copy={copy.cta} />
      </main>
      <NsxFooter copy={copy.footer} />
    </div>
  );
}
