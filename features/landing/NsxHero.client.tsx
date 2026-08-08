"use client";

import Image from "next/image";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { NsxBtnPrimary } from "./NsxButtons";
import { NsxReveal } from "./NsxReveal.client";

const AVATARS = [
  "/nexsas/automation/images/ns-avatar-11.jpg",
  "/nexsas/automation/images/ns-avatar-13.jpg",
  "/nexsas/automation/images/ns-avatar-14.jpg",
] as const;

export function NsxHero() {
  return (
    <section className="nsx-hero" id="soluciones">
      <video
        className="nsx-hero-video"
        autoPlay
        muted
        loop
        playsInline
        poster="/landing/holistic/hero-dashboard.png"
      >
        <source
          src="/nexsas/automation/videos/hero-video.mp4"
          type="video/mp4"
        />
      </video>
      <div className="nsx-hero-scrim" aria-hidden />

      <div className="nsx-container relative z-10">
        <div className="space-y-9 text-center md:space-y-16">
          <div className="space-y-8 md:space-y-[4.25rem]">
            <div className="space-y-6">
              <div className="mx-auto flex max-w-[18rem] items-center justify-center gap-x-3 sm:max-w-[20rem]">
                <div className="flex -space-x-3.5">
                  {AVATARS.map((src, i) => (
                    <NsxReveal key={src} delayMs={80 + i * 60}>
                      <Image
                        src={src}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 rounded-full object-cover outline outline-2 outline-[#f5f5f7]"
                      />
                    </NsxReveal>
                  ))}
                </div>
                <NsxReveal delayMs={220}>
                  <p className="max-w-[11rem] shrink-0 text-left text-[0.875rem] leading-snug text-[rgb(26_26_28_/_0.8)]">
                    <span className="font-semibold text-[var(--nsx-secondary)]">
                      +180
                    </span>{" "}
                    equipos en Latam ya operan con {siteConfig.name}.
                  </p>
                </NsxReveal>
              </div>

              <div className="space-y-4">
                <NsxReveal delayMs={120}>
                  <h1 className="nsx-h1 mx-auto max-w-[950px]">
                    Opera campañas, pagos y saldos
                    <br className="hidden sm:block" /> en un solo lugar.
                  </h1>
                </NsxReveal>
                <NsxReveal delayMs={180}>
                  <p className="mx-auto max-w-[560px] text-base text-[var(--nsx-muted)] md:text-lg">
                    Recarga la {siteConfig.walletName}, asigna presupuesto a
                    cuentas TikTok y controla gasto, cobros Hecom Club y
                    clientes sin planillas ni dashboards genéricos.
                  </p>
                </NsxReveal>
              </div>
            </div>

            <NsxReveal delayMs={240}>
              <div className="flex flex-col items-center justify-center">
                <NsxBtnPrimary
                  href={routes.login}
                  className="w-[70%] justify-center md:w-auto"
                >
                  Entrar
                </NsxBtnPrimary>
              </div>
            </NsxReveal>
          </div>

          <NsxReveal delayMs={300}>
            <figure className="nsx-hero-banner relative z-10">
              <Image
                src="/landing/holistic/hero-dashboard.png"
                alt={`${siteConfig.name} — panel de cartera, cuentas TikTok y operación Hecom`}
                width={1600}
                height={1000}
                priority
                className="size-full object-cover object-top"
              />
            </figure>
          </NsxReveal>
        </div>
      </div>

      <figure className="nsx-hero-gradient" aria-hidden>
        <Image
          src="/nexsas/automation/images/bottom-gradient.svg"
          alt=""
          width={1920}
          height={700}
          className="size-full object-cover"
        />
      </figure>
    </section>
  );
}
