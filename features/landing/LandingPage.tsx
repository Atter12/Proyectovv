import dynamic from "next/dynamic";
import { LandingNav } from "./LandingNav";
import { LandingHero } from "./LandingHero";
import { LandingFooter } from "./LandingFooter";

/** Secciones bajo el fold: no bloquean first paint (China / red lenta). */
const LandingClients = dynamic(() =>
  import("./LandingClients").then((m) => ({ default: m.LandingClients })),
);
const LandingCore = dynamic(() =>
  import("./LandingCore").then((m) => ({ default: m.LandingCore })),
);
const LandingHow = dynamic(() =>
  import("./LandingHow").then((m) => ({ default: m.LandingHow })),
);
const LandingTools = dynamic(() =>
  import("./LandingTools").then((m) => ({ default: m.LandingTools })),
);
const LandingStats = dynamic(() =>
  import("./LandingStats").then((m) => ({ default: m.LandingStats })),
);
const LandingTestimonials = dynamic(() =>
  import("./LandingTestimonials.client").then((m) => ({
    default: m.LandingTestimonials,
  })),
);
const LandingCta = dynamic(() =>
  import("./LandingCta").then((m) => ({ default: m.LandingCta })),
);

/**
 * Landing: hero + nav primero (CSS crítico).
 * DotGrid / secciones largas diferidas para redes lentas (China).
 */
export function LandingPage() {
  return (
    <div className="auth-canvas relative min-h-screen overflow-x-hidden">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-[#0f172a]"
      >
        Saltar al contenido
      </a>

      {/* Sin DotGrid canvas: gradientes del auth-canvas bastan y pesan menos */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_70%_60%_at_40%_40%,rgb(248_250_252_/_0.7),transparent_75%)]"
      />

      <div className="relative z-10">
        <LandingNav />
        <main id="contenido">
          <LandingHero />
          <LandingClients />
          <LandingCore />
          <LandingHow />
          <LandingTools />
          <LandingStats />
          <LandingTestimonials />
          <LandingCta />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
