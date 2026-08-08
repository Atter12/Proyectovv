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
      {/* Video solo desktop: en móvil parpadea / pesa y rompe el primer paint */}
      <video
        className="nsx-hero-video nsx-hero-video--desktop"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/landing/holistic/hero-dashboard.png"
        aria-hidden
      >
        <source
          src="/nexsas/automation/videos/hero-video.mp4"
          type="video/mp4"
        />
      </video>
      <div className="nsx-hero-static" aria-hidden />
      <div className="nsx-hero-scrim" aria-hidden />

      <div className="nsx-container relative z-10">
        <div className="nsx-hero-stack">
          <div className="nsx-hero-copy">
            <div className="nsx-hero-social">
              <div className="nsx-hero-avatars">
                {AVATARS.map((src) => (
                  <Image
                    key={src}
                    src={src}
                    alt=""
                    width={44}
                    height={44}
                    className="nsx-hero-avatar"
                  />
                ))}
              </div>
              <p className="nsx-hero-social-text">
                <span className="font-semibold text-[var(--nsx-secondary)]">
                  +180
                </span>{" "}
                equipos en Latam ya operan con {siteConfig.name}.
              </p>
            </div>

            <div className="nsx-hero-titles">
              <h1 className="nsx-h1 mx-auto max-w-[950px]">
                Opera campañas, pagos y saldos
                <br className="hidden sm:block" /> en un solo lugar.
              </h1>
              <p className="nsx-hero-lead">
                Recarga la {siteConfig.walletName}, asigna presupuesto a cuentas
                TikTok y controla gasto, cobros Hecom Club y clientes sin
                planillas ni dashboards genéricos.
              </p>
            </div>

            <div className="nsx-hero-cta">
              <NsxBtnPrimary
                href={routes.login}
                className="nsx-hero-cta-btn justify-center"
              >
                Entrar
              </NsxBtnPrimary>
            </div>
          </div>

          <NsxReveal delayMs={80} eager>
            <figure className="nsx-hero-banner relative z-10">
              <Image
                src="/landing/holistic/hero-dashboard.png"
                alt={`${siteConfig.name} — panel de cartera, cuentas TikTok y operación Hecom`}
                width={1600}
                height={1000}
                priority
                sizes="(max-width: 768px) 100vw, min(1290px, 92vw)"
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
          priority={false}
        />
      </figure>
    </section>
  );
}
