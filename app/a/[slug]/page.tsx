import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivePartnerBySlug } from "@/lib/partners/partners.server";
import { routes } from "@/config/routes";
import { AuthRechargeDemo } from "@/features/auth/components/AuthRechargeDemo.client";
import { PartnerVisitTracker } from "@/features/partners/components/PartnerVisitTracker.client";
import { partnerLogoSize, partnerPalette } from "@/lib/partners/partners.shared";

export const dynamic = "force-dynamic";

const HOLISTIC_WHATSAPP = "51933484150";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getActivePartnerBySlug(slug);
  if (!partner) return { title: "Ads Holistic", robots: { index: false, follow: false } };
  return {
    title: `Ads Holistic × ${partner.companyName?.trim() || partner.name}`,
    description: partner.subheadline ?? "Cuentas de agencia de TikTok, recarga desde cualquier país y saldo al instante.",
    ...(partner.faviconUrl ? { icons: { icon: partner.faviconUrl, shortcut: partner.faviconUrl, apple: partner.faviconUrl } } : {}),
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
  const headline = partner.headline ?? "Lanza y escala tus campañas de TikTok";
  // Empresa del aliado (con su logo) y la persona que recomienda.
  const brand = partner.companyName?.trim() || partner.name;
  // Colores que el aliado arma en su sección Alianzas (o el tema claro/oscuro de siempre).
  const pal = partnerPalette(partner);
  const logoSize = partnerLogoSize(partner.logoSize);
  const vars = {
    "--accent": pal.accent,
    "--bg": pal.background,
    "--ink": pal.text,
    "--muted": pal.muted,
    "--faint": pal.faint,
    "--line": pal.border,
    "--card": pal.card,
    "--band": pal.band,
  } as CSSProperties;
  // Si el secundario es igual al principal, el botón de la franja final se invierte para que se vea.
  const bandButton =
    pal.secondary.toLowerCase() === pal.accent.toLowerCase()
      ? { background: pal.secondaryInk, color: pal.secondary }
      : { background: pal.accent, color: pal.accentInk };
  const c = {
    muted: "text-[var(--muted)]",
    faint: "text-[var(--faint)]",
    pill: "border-[var(--line)] bg-[var(--card)] text-[var(--muted)]",
    ghost: "border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[var(--card)]",
    band: "border-[var(--line)] bg-[var(--band)]",
    card: "border-[var(--line)] bg-[var(--card)]",
    foot: "border-[var(--line)] text-[var(--faint)]",
    frame: "border-[var(--line)]",
  };
  const subheadline =
    partner.subheadline ??
    "Cuentas de agencia, recarga desde cualquier país y saldo al instante. Todo en una sola app.";
  const bannerSrc = partner.bannerUrl ?? partner.bannerMobileUrl;
  const banner = bannerSrc ? (
    <picture>
      {partner.bannerMobileUrl && partner.bannerUrl ? <source media="(max-width: 640px)" srcSet={partner.bannerMobileUrl} /> : null}
      <img src={bannerSrc} alt={`Banner de ${brand}`} className="block h-auto w-full" />
    </picture>
  ) : null;

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]" style={vars}>
      <PartnerVisitTracker slug={partner.slug} />

      {/* Logos al centro; «Iniciar sesión» a la derecha. */}
      <header className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-5 sm:px-8">
        <span aria-hidden />
        <div className="flex min-w-0 items-center justify-center gap-3">
          <Image
            src="/brand/holistic-marketing-logo.png"
            alt="Holistic Marketing"
            width={506}
            height={187}
            className={`w-auto ${pal.dark ? "brightness-0 invert" : ""}`}
            style={{ height: Math.round(logoSize * 0.9) }}
            priority
          />
          <span className={`text-[18px] font-light ${c.faint}`} aria-hidden>×</span>
          {partner.logoUrl ? (
            // Logos externos de cada aliado: <img> evita configurar dominios en next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partner.logoUrl} alt={brand} className="w-auto max-w-[40vw] object-contain" style={{ height: logoSize }} />
          ) : (
            <span className="truncate text-[15px] font-bold tracking-[-0.02em]">{brand}</span>
          )}
        </div>
        {/* En celular no entra al lado de los logos: baja debajo de los botones. */}
        <Link href={routes.login} className="hidden justify-self-end text-[14px] font-semibold underline underline-offset-4 sm:block">
          Iniciar sesión
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-10">
          <div>
            <p className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${c.pill}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: pal.secondary }} />
              Alianza oficial · {brand}
            </p>
            <h1 className="mt-5 text-[34px] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[48px]">{headline}</h1>
            <p className={`mt-4 max-w-xl text-[16px] leading-relaxed sm:text-[18px] ${c.muted}`}>{subheadline}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={registerHref}
                className="inline-flex h-12 items-center justify-center rounded-xl px-7 text-[15px] font-bold shadow-[0_10px_22px_-12px_rgb(0_0_0/0.45)] transition hover:brightness-95"
                style={{ background: pal.accent, color: pal.accentInk }}
              >
                Crear mi cuenta gratis →
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-12 items-center justify-center rounded-xl border px-6 text-[15px] font-semibold transition ${c.ghost}`}
              >
                Hablar por WhatsApp
              </a>
            </div>

            <p className={`mt-4 text-[14px] sm:hidden ${c.muted}`}>
              ¿Ya tienes cuenta?{" "}
              <Link href={routes.login} className="font-semibold text-[var(--ink)] underline underline-offset-4">
                Inicia sesión
              </Link>
            </p>

            <div className="mt-8 flex items-center gap-3">
              {partner.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={partner.photoUrl} alt={partner.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-white" />
              ) : null}
              <p className={`text-[14px] ${c.muted}`}>
                Recomendado por <strong className="text-[var(--ink)]">{partner.name}</strong>
                {partner.companyName ? ` · ${partner.companyName}` : ""}
              </p>
            </div>
          </div>

          <div className={`relative h-[560px] overflow-hidden rounded-[28px] border ${c.frame} shadow-[0_30px_60px_-30px_rgb(60_35_15/0.35)] sm:h-[620px]`}>
            <AuthRechargeDemo caption={{ title: "Recarga desde cualquier país.\nImpulsa tus campañas." }} />
          </div>
        </section>

        {banner ? (
          <section className="mx-auto max-w-6xl px-5 pb-14 sm:px-8">
            <div className={`overflow-hidden rounded-[20px] border ${c.frame}`}>
              {partner.bannerLink ? (
                <a href={partner.bannerLink} target="_blank" rel="noreferrer">
                  {banner}
                </a>
              ) : (
                banner
              )}
            </div>
          </section>
        ) : null}

        <section className={`border-y ${c.band}`}>
          <div className="mx-auto grid max-w-6xl gap-4 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className={`rounded-2xl border p-5 ${c.card}`}>
                <span className="block h-1.5 w-8 rounded-full" style={{ background: pal.secondary }} />
                <h2 className="mt-4 text-[16px] font-bold tracking-[-0.02em]">{b.title}</h2>
                <p className={`mt-2 text-[14px] leading-relaxed ${c.muted}`}>{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="text-[26px] font-bold tracking-[-0.03em] sm:text-[32px]">Empieza en 3 pasos</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`rounded-2xl border p-5 ${c.card}`}>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-bold" style={{ background: pal.secondary, color: pal.secondaryInk }}>
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[16px] font-bold">{s.title}</h3>
                <p className={`mt-1.5 text-[14px] leading-relaxed ${c.muted}`}>{s.body}</p>
              </li>
            ))}
          </ol>

          {/* Franja final en el color secundario. */}
          <div
            className="mt-12 flex flex-col items-start justify-between gap-5 rounded-[24px] px-6 py-8 sm:flex-row sm:items-center sm:px-10"
            style={{ background: pal.secondary, color: pal.secondaryInk }}
          >
            <div>
              <p className="text-[22px] font-bold tracking-[-0.03em]">¿Listo para anunciar?</p>
              <p className="mt-1 text-[14px] opacity-80">Crea tu cuenta y recarga cuando quieras. Sin mensualidades.</p>
            </div>
            <Link
              href={registerHref}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl px-7 text-[15px] font-bold"
              style={bandButton}
            >
              Crear mi cuenta →
            </Link>
          </div>
        </section>
      </main>

      <footer className={`border-t py-6 text-center text-[13px] ${c.foot}`}>
        © {new Date().getFullYear()} Holistic Marketing · Ads Holistic
      </footer>
    </div>
  );
}
