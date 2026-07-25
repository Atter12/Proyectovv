import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";

type HolisticLogoProps = {
  className?: string;
  size?: number;
  title?: string;
};

/**
 * Holistic Marketing mark (logo oficial Hecom / Holistic).
 * `EcomdyLogo` se mantiene como alias para no romper imports existentes.
 */
export function HolisticLogo({
  className,
  size = 40,
  title = siteConfig.name,
}: HolisticLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={siteConfig.logoSrc}
      alt={title}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/** @deprecated Usar HolisticLogo — alias de compatibilidad */
export function EcomdyLogo(props: HolisticLogoProps) {
  return <HolisticLogo {...props} />;
}

export function HolisticWordmark({
  className,
  markSize = 40,
  showWord = true,
  wordClassName,
}: {
  className?: string;
  markSize?: number;
  showWord?: boolean;
  wordClassName?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <HolisticLogo size={markSize} />
      {showWord ? (
        <span
          className={cn(
            "truncate text-[1.05em] font-semibold tracking-[-0.03em] text-[var(--auth-text,#f8fafc)]",
            wordClassName,
          )}
        >
          {siteConfig.name}
        </span>
      ) : null}
    </div>
  );
}

/** @deprecated Usar HolisticWordmark */
export function EcomdyWordmark(props: {
  className?: string;
  markSize?: number;
  showWord?: boolean;
}) {
  return <HolisticWordmark {...props} />;
}
