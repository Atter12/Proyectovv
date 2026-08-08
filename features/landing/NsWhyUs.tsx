import Image from "next/image";
import Link from "next/link";
import { routes } from "@/config/routes";
import { NsReveal } from "./NsReveal.client";

const left = [
  {
    title: "Agencias",
    description:
      "Operá múltiples clientes, fees y cuentas sin mezclar saldos ni scopes.",
  },
  {
    title: "E-commerce",
    description:
      "Controlá gasto diario y recargas cuando el ROAS exige velocidad.",
  },
  {
    title: "SaaS & tech",
    description:
      "Un panel limpio para performance: menos ruido, más claridad de caja.",
  },
] as const;

const right = [
  {
    title: "Retail digital",
    description:
      "Visibilidad del gasto y del fondeo para equipos multi-cuenta TikTok.",
  },
  {
    title: "Marcas locales",
    description:
      "El cliente ve su saldo y gasto; el gerente opera con la misma verdad.",
  },
  {
    title: "Equipos híbridos",
    description:
      "Gerente, creativos y cobranzas alineados sobre un solo CRM Hecom.",
  },
] as const;

function Feature({
  title,
  description,
  delayMs,
}: {
  title: string;
  description: string;
  delayMs: number;
}) {
  return (
    <NsReveal delayMs={delayMs} className="space-y-3">
      <div className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10 text-[var(--ns-accent)]">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-[var(--ns-accent)]">{title}</h3>
      <p className="text-sm leading-relaxed text-white/60">{description}</p>
    </NsReveal>
  );
}

export function NsWhyUs() {
  return (
    <section id="por-que" className="ns-section">
      <div className="ns-container">
        <div className="ns-why">
          <figure className="ns-why-glow" aria-hidden>
            <Image
              src="/nexsas/ns-img-498.png"
              alt=""
              width={1060}
              height={1060}
              className="h-full w-full object-contain"
            />
          </figure>

          <div className="relative z-10 space-y-14">
            <div className="space-y-7 text-center md:text-left">
              <div className="space-y-3">
                <NsReveal delayMs={60}>
                  <h2 className="ns-h2 max-w-[36rem] text-[var(--ns-accent)]">
                    ¿Por qué Holistic?
                  </h2>
                </NsReveal>
                <NsReveal delayMs={120}>
                  <p className="max-w-[28rem] text-white/60 md:w-full">
                    Una plataforma hecha para la operación real de ads — no un
                    dashboard genérico.
                  </p>
                </NsReveal>
              </div>
              <NsReveal delayMs={180}>
                <Link
                  href={routes.register}
                  className="ns-btn ns-btn-md ns-btn-dark"
                >
                  Explorar el producto
                </Link>
              </NsReveal>
            </div>

            <div className="mx-auto flex max-w-[73rem] flex-col items-center justify-between gap-10 md:flex-row md:items-start md:gap-8">
              <div className="w-full max-w-[19rem] space-y-8">
                {left.map((item, i) => (
                  <Feature key={item.title} {...item} delayMs={220 + i * 80} />
                ))}
              </div>

              <NsReveal
                delayMs={280}
                className="hidden w-full max-w-[16rem] flex-1 lg:block"
              >
                <div className="mx-auto flex aspect-square max-w-[15rem] items-center justify-center rounded-full border border-white/10 bg-white/5 p-8 text-center">
                  <p className="text-sm font-medium leading-relaxed text-white/80">
                    Cliente y gerente ven la misma verdad de gasto y saldo.
                  </p>
                </div>
              </NsReveal>

              <div className="w-full max-w-[19rem] space-y-8">
                {right.map((item, i) => (
                  <Feature key={item.title} {...item} delayMs={280 + i * 80} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
