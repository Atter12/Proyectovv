"use client";

import Image from "next/image";
import { routes } from "@/config/routes";
import { NsxBtnPrimary, NsxBtnSecondary } from "./NsxButtons";
import { NsxReveal } from "./NsxReveal.client";

const AVATARS = [
  "/nexsas/automation/images/ns-avatar-11.jpg",
  "/nexsas/automation/images/ns-avatar-13.jpg",
  "/nexsas/automation/images/ns-avatar-14.jpg",
] as const;

export function NsxHero() {
  return (
    <section className="nsx-hero">
      <video
        className="nsx-hero-video"
        autoPlay
        muted
        loop
        playsInline
        poster="/nexsas/automation/images/ns-img-3.png"
      >
        <source src="/nexsas/automation/videos/hero-video.mp4" type="video/mp4" />
      </video>
      <div className="nsx-hero-scrim" aria-hidden />

      <div className="nsx-container relative z-10">
        <div className="space-y-9 text-center md:space-y-16">
          <div className="space-y-8 md:space-y-[4.25rem]">
            <div className="space-y-6">
              <div className="mx-auto flex max-w-[16rem] items-center justify-center gap-x-3">
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
                  <p className="max-w-[9rem] shrink-0 text-left text-[0.875rem] leading-snug text-[rgb(26_26_28_/_0.8)]">
                    <span className="font-semibold text-[var(--nsx-secondary)]">2,000+</span>{" "}
                    teams shipping faster this week.
                  </p>
                </NsxReveal>
              </div>

              <div className="space-y-4">
                <NsxReveal delayMs={120}>
                  <h1 className="nsx-h1 mx-auto max-w-[950px]">
                    Automate your workflows
                    <br className="hidden sm:block" />{" "}
                    eliminate manual tasks.
                  </h1>
                </NsxReveal>
                <NsxReveal delayMs={180}>
                  <p className="mx-auto max-w-[500px] text-base text-[var(--nsx-muted)] md:text-lg">
                    Connect your tools, design smart workflows, and automate
                    repetitive work — so your business runs on autopilot.
                  </p>
                </NsxReveal>
              </div>
            </div>

            <NsxReveal delayMs={240}>
              <div className="flex flex-col items-center justify-center gap-y-3 md:flex-row md:gap-x-5">
                <NsxBtnPrimary
                  href={routes.register}
                  className="w-[70%] justify-center md:w-auto"
                >
                  Start free trial
                </NsxBtnPrimary>
                <NsxBtnSecondary
                  href={routes.login}
                  className="w-[70%] justify-center md:w-auto"
                >
                  Book demo
                </NsxBtnSecondary>
              </div>
            </NsxReveal>
          </div>

          <NsxReveal delayMs={300}>
            <figure className="nsx-hero-banner relative z-10">
              <Image
                src="/nexsas/automation/images/ns-img-3.png"
                alt="Nexsas product dashboard"
                width={1600}
                height={1000}
                priority
                className="size-full object-cover object-top"
              />
            </figure>
          </NsxReveal>
        </div>

        <figure className="pointer-events-none absolute top-[50%] left-[-5%] z-20 hidden h-14 will-change-transform md:block 2xl:left-[-8%]">
          <Image
            src="/nexsas/automation/images/ns-img-27.svg"
            alt=""
            width={200}
            height={56}
            className="h-full w-auto"
          />
        </figure>
        <figure className="pointer-events-none absolute top-[42%] right-[-3%] z-20 hidden h-14 will-change-transform md:block 2xl:right-[-5%]">
          <Image
            src="/nexsas/automation/images/ns-img-28.svg"
            alt=""
            width={200}
            height={56}
            className="h-full w-auto"
          />
        </figure>
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
