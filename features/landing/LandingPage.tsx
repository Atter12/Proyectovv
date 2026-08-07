import dynamic from "next/dynamic";
import { LandingNav } from "./LandingNav";
import { LandingHero } from "./LandingHero";
import { LandingFooter } from "./LandingFooter";

/** Secciones bajo el fold: no bloquean first paint. */
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
 * Landing principal — Exquisitus (letra + craft) × Holistic (#ff781f) + flow.
 */
export function LandingPage() {
  return (
    <div className="landing-shell relative min-h-screen overflow-x-hidden">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:font-register focus:text-sm focus:text-[var(--landing-ink)]"
      >
        Saltar al contenido
      </a>

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
