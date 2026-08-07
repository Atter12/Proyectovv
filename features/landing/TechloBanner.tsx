import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { TechloButton } from "./TechloButton";

export function TechloBanner() {
  return (
    <section className="banner-three-section">
      <div className="tl-container relative z-20 py-36 sm:py-44 lg:py-48">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/techlo/banner/map.svg"
          alt=""
          aria-hidden
          className="banner-three-map"
        />
        <div className="banner-three-gradient" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/techlo/banner/home-three-gradient-bg.svg"
            alt=""
          />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h1 className="banner-three-title tl-display tl-display-lg text-white">
            {siteConfig.name}: crece con control real en ads
          </h1>
          <p className="banner-three-description mx-auto mt-5 max-w-3xl text-[1.05rem] text-[var(--tl-light)] md:text-lg">
            Cartera Holistic, cuentas TikTok y pagos en un solo panel — para
            agencias y equipos de performance en Latam.
          </p>
          <div className="banner-three-actions mt-10 flex flex-wrap items-center justify-center gap-4">
            <TechloButton href={routes.login} label="Entrar al panel" />
            <TechloButton
              href="#proceso"
              label="Ver el proceso"
              variant="white"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
