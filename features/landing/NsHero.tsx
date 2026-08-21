import Image from "next/image";
import Link from "next/link";
import { routes } from "@/config/routes";
import { NsReveal } from "./NsReveal.client";

const clients = [
  "Agencias de performance",
  "E-commerce Latam",
  "SaaS B2B",
  "Retail digital",
  "Medios y content",
];

const clientLogos = [
  "/nexsas/icons/client-logo-1-white.svg",
  "/nexsas/icons/client-logo-2-white.svg",
  "/nexsas/icons/client-logo-3-white.svg",
  "/nexsas/icons/client-logo-4-white.svg",
  "/nexsas/icons/client-logo-5-white.svg",
] as const;

export function NsHero() {
  return (
    <section className="ns-hero">
      <figure className="ns-hero-dots" aria-hidden>
        {/* SVG decorativo: <img> evita constraints de next/image en SVG. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nexsas/ns-img-292.svg"
          alt=""
          width={1362}
          height={800}
          className="h-full w-full"
        />
      </figure>

      <div className="ns-container relative z-10">
        <div className="mb-14 flex flex-col items-center text-center md:mb-16">
          <NsReveal delayMs={40}>
            <h1 className="ns-h1 mb-4 max-w-[1000px]">
              Impulsa tu crecimiento con ads bajo control real
            </h1>
          </NsReveal>
          <NsReveal delayMs={120}>
            <p className="mb-7 max-w-[850px] text-base text-[var(--ns-muted)] md:mb-14 md:text-lg">
              Cartera, cuentas TikTok, recargas y gasto del cliente en un solo
              lugar — para gerentes y marcas que operan en Latam con Holistic
              Marketing.
            </p>
          </NsReveal>
          <ul className="mb-10 flex w-[90%] flex-col gap-3 md:mb-14 md:w-auto md:flex-row">
            <NsReveal as="li" delayMs={180} className="w-full sm:w-auto">
              <Link
                href={routes.register}
                className="ns-btn ns-btn-xl ns-btn-secondary w-full sm:w-auto"
              >
                Empezar gratis
              </Link>
            </NsReveal>
            <NsReveal as="li" delayMs={240} className="w-full sm:w-auto">
              <Link
                href={routes.login}
                className="ns-btn ns-btn-xl ns-btn-white w-full border-0 sm:w-auto"
              >
                Entrar al panel
              </Link>
            </NsReveal>
          </ul>
        </div>

        <div className="mb-16 flex items-center justify-center gap-x-4 md:mb-20">
          <div className="flex -space-x-3.5">
            {[1, 2, 3].map((n, i) => (
              <NsReveal key={n} delayMs={300 + i * 80}>
                <Image
                  src={`/nexsas/ns-avatar-${n}.png`}
                  alt=""
                  width={48}
                  height={48}
                  className="inline-block size-12 rounded-full bg-[#98AAC3] ring-2 ring-white"
                />
              </NsReveal>
            ))}
            <NsReveal delayMs={560}>
              <div className="inline-flex size-12 items-center justify-center rounded-full bg-[#98AAC3] text-xs font-medium text-[var(--ns-secondary)] ring-2 ring-white">
                99+
              </div>
            </NsReveal>
          </div>
          <NsReveal delayMs={620}>
            <div className="text-left">
              <p className="block text-sm font-medium text-[var(--ns-secondary)]">
                +180 equipos ya operan con Holistic
              </p>
              <p className="max-w-[12rem] text-xs text-[var(--ns-muted)]">
                Tu marca puede ser el próximo caso de control real en ads.
              </p>
            </div>
          </NsReveal>
        </div>

        <NsReveal delayMs={700}>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 opacity-70 md:gap-x-10">
            {clientLogos.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                width={120}
                height={36}
                className="h-8 w-auto invert"
              />
            ))}
          </div>
          <p className="sr-only">{clients.join(", ")}</p>
        </NsReveal>
      </div>
    </section>
  );
}
