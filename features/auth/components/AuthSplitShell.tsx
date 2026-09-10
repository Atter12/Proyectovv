import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { routes } from "@/config/routes";

interface AuthSplitShellProps {
  children: React.ReactNode;
  /** Texto sobre la imagen pastel (solo escritorio). */
  caption: { title: string; sub?: string };
  /** Link de la esquina superior derecha. */
  topRight: { label: string; href: string };
  /** Encuadre de la imagen; cambia entre login y registro para que no se repita. */
  imagePosition?: string;
}

const BRAND_LOGO = "/brand/holistic-marketing-logo.png";
const SIDE_ART = "/auth/login-side-waves.png";

function BrandLogo({ className }: { className?: string }) {
  return (
    <Link href={routes.home} aria-label={siteConfig.name} className={className}>
      {/* La altura vive en .auth-logo para no depender del orden de utilidades. */}
      <Image
        src={BRAND_LOGO}
        alt={siteConfig.name}
        width={506}
        height={183}
        priority
        className="auth-logo"
      />
    </Link>
  );
}

/**
 * Armazón de login y registro: blanco a la izquierda, pastel a la derecha.
 *
 * El naranja aparece solo en el logo, en el borde del campo activo y en los
 * links. El botón principal va en carbón porque blanco sobre #ff781f da 2.6:1
 * y no pasa AA.
 */
export function AuthSplitShell({
  children,
  caption,
  topRight,
  imagePosition = "60% 50%",
}: AuthSplitShellProps) {
  return (
    <div className="auth-shell relative min-h-[100dvh] overflow-x-hidden">
      {/* Móvil: la franja lleva imagen y logo. Antes era un degradado vacío. */}
      <div className="relative h-[150px] w-full overflow-hidden sm:h-[186px] lg:hidden">
        <Image
          src={SIDE_ART}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "55% 62%" }}
        />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <BrandLogo className="inline-flex shrink-0 items-center" />
          <Link
            href={topRight.href}
            className="shrink-0 rounded-xl bg-[#17150f]/90 px-3.5 py-2 text-[12.5px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-[#17150f]"
          >
            {topRight.label}
          </Link>
        </div>
      </div>

      <div className="grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
        <div className="flex flex-col px-5 pb-8 pt-7 sm:px-8 sm:pb-10 lg:px-14 lg:py-12 xl:px-20">
          <header className="hidden items-center justify-between gap-3 lg:flex">
            <BrandLogo className="inline-flex shrink-0 items-center" />
            <Link
              href={topRight.href}
              className="shrink-0 rounded-xl border border-[#e4e0db] px-4 py-2 text-[13px] font-semibold text-[#17150f] transition-colors hover:border-[#17150f]/30 hover:bg-[#fbfaf9]"
            >
              {topRight.label}
            </Link>
          </header>

          <main className="flex flex-1 flex-col justify-center lg:py-10">
            <div className="w-full max-w-[420px]">{children}</div>
          </main>

          <p className="mt-8 text-[12px] text-[#a39c94] lg:mt-0">
            © {new Date().getFullYear()} {siteConfig.companyName}
          </p>
        </div>

        <div className="relative hidden overflow-hidden lg:block">
          <Image
            src={SIDE_ART}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 0px"
            className="object-cover"
            style={{ objectPosition: imagePosition }}
          />
          <div className="absolute inset-x-0 bottom-0 z-[1] px-11 pb-10">
            <p className="max-w-[14ch] text-[26px] font-bold leading-[1.18] tracking-[-0.022em] text-[#241a14]">
              {caption.title}
            </p>
            {caption.sub ? (
              <p className="mt-2.5 max-w-[28ch] text-[13.5px] font-medium leading-[1.5] text-[#241a14]/70">
                {caption.sub}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
