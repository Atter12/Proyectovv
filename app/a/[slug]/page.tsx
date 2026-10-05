import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivePartnerBySlug } from "@/lib/partners/partners.server";
import { routes } from "@/config/routes";
import { AuthRechargeDemo } from "@/features/auth/components/AuthRechargeDemo.client";
import { PartnerVisitTracker } from "@/features/partners/components/PartnerVisitTracker.client";

export const dynamic = "force-dynamic";

const HOLISTIC_WHATSAPP = "51933484150";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getActivePartnerBySlug(slug);
  if (!partner) return { title: "Ads Holistic", robots: { index: false, follow: false } };
  return {
    title: `Ads Holistic × ${partner.name}`,
    description: partner.subheadline ?? "Cuentas de agencia de TikTok, recarga desde cualquier país y saldo al instante.",
    // Cada aliado comparte su link; no hace falta que Google indexe estas páginas.
    robots: { index: false, follow: false },
  };
}

const BENEFITS = [
  {
    title: "Cuentas de agencia de TikTok",
    body: "Crea tus cuentas publicitarias desde la app, listas para anunciar en minutos.",
  },
  {
    title: "Recarga como prefieras",
    body: "Tarjeta Visa o Mastercard, Yape, Plin o USDT. Desde Perú, Brasil, Colombia, Ecuador y más.",
  },
  {
    title: "Saldo al instante",
    body: "Tu recarga entra a tu cartera y la asignas a la cuenta que quieras con un toque.",
  },
  {
    title: "Mide lo que ganas",
    body: "Píxeles, gasto en vivo y ganancia por campaña en un solo panel.",
  },
];

const STEPS = [
  { title: "Crea tu cuenta", body: "Con tu correo y DNI. Te llega un código y entras." },
  { title: "Recarga tu cartera", body: "En tu moneda o en dólares, con el método que uses." },
  { title: "Asigna y anuncia", body: "Pasa el saldo a tu cuenta TikTok y lanza tus campañas." },
];

export default async function PartnerLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const partner = await getActivePartnerBySlug(slug);
  if (!partner) notFound();

  const registerHref = `${routes.register}?a=${encodeURIComponent(partner.slug)}`;
  const whatsapp = (partner.whatsapp ?? HOLISTIC_WHATSAPP).replace(/\D/g, "");
  const whatsappHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    `Hola, vengo de parte de ${partner.name} y quiero empezar con Ads Holistic.`,
  )}`;
  const accent = /^#[0-9a-fA-F]{6}$/.test(partner.accentColor) ? partner.accentColor : "#ff781f";
  const headline = partner.headline ?? "Lanza y escala tus campañas de TikTok";
  const subheadline =
    partner.subheadline ??
    "Cuentas de agencia, recarga desde cualquier país y saldo al instante. Todo en una sola app.";

  return (
    <div className="min-h-dvh bg-[#fcfbf9] text-[#1c1917]" style={{ ["--accent" as string]: accent }}>
      <PartnerVisitTracker slug={partner.slug} />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/brand/holistic-marketing-logo.png" alt="Holistic Marketing" width={506} height={187} className="h-auto w-[112px] sm:w-[132px]" priority />
          <span className="text-[18px] font-light text-[#b5ada5]" aria-hidden>×</span>
          {partner.logoUrl ? (
            // Logos externos de cada aliado: <img> evita configurar dominios en next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partner.logoUrl} alt={partner.name} className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            <span className="truncate text-[15px] font-bold tracking-[-0.02em]">{partner.name}</span>
          )}
        </div>
        <Link href={routes.login} className="shrink-0 text-[14px] font-semibold underline underline-offset-4">
          Iniciar sesión
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#efe4d8] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5f574f]">
              <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
              Alianza oficial · {partner.name}
            </p>
            <h1 className="mt-5 text-[34px] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[48px]">{headline}</h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#5f574f] sm:text-[18px]">{subheadline}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={registerHref}
                className="inline-flex h-12 items-center justify-center rounded-xl px-7 text-[15px] font-bold text-[#1c1917] shadow-[0_10px_22px_-12px_rgb(232_89_12/0.7)] transition hover:brightness-95"
                style={{ background: accent }}
              >
                Crear mi cuenta gratis →
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-[#e3dbd1] bg-white px-6 text-[15px] font-semibold text-[#3a332d] transition hover:bg-[#f7f5f2]"
              >
                Hablar por WhatsApp
              </a>
            </div>

            {partner.photoUrl ? (
              <div className="mt-8 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partner.photoUrl} alt={partner.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-white" />
                <p className="text-[14px] text-[#5f574f]">
                  Recomendado por <strong className="text-[#1c1917]">{partner.name}</strong>
                </p>
              </div>
            ) : null}
          </div>

          <div className="relative h-[560px] overflow-hidden rounded-[28px] border border-[#efe4d8] shadow-[0_30px_60px_-30px_rgb(60_35_15/0.35)] sm:h-[620px]">
            <AuthRechargeDemo caption={{ title: "Recarga desde cualquier país.\nImpulsa tus campañas." }} />
          </div>
        </section>

        <section className="border-y border-[#efe7de] bg-white">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-[#efe7de] bg-[#fcfbf9] p-5">
                <span className="block h-1.5 w-8 rounded-full" style={{ background: accent }} />
                <h2 className="mt-4 text-[16px] font-bold tracking-[-0.02em]">{b.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-[#5f574f]">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="text-[26px] font-bold tracking-[-0.03em] sm:text-[32px]">Empieza en 3 pasos</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-[#efe7de] bg-white p-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ background: accent }}>
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[16px] font-bold">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#5f574f]">{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-[24px] bg-[#1c1917] px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
            <div>
              <p className="text-[22px] font-bold tracking-[-0.03em]">¿Listo para anunciar?</p>
              <p className="mt-1 text-[14px] text-[#d6cfc8]">Crea tu cuenta y recarga cuando quieras. Sin mensualidades.</p>
            </div>
            <Link
              href={registerHref}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl px-7 text-[15px] font-bold text-[#1c1917]"
              style={{ background: accent }}
            >
              Crear mi cuenta →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#efe7de] py-6 text-center text-[13px] text-[#8a8177]">
        © {new Date().getFullYear()} Holistic Marketing · Ads Holistic
      </footer>
    </div>
  );
}
