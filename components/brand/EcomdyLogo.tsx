import { cn } from "@/lib/cn";

type EcomdyLogoProps = {
  className?: string;
  size?: number;
  title?: string;
};

/**
 * Ecomdy mark — geometric "e" + signal bar (ads/performance).
 */
export function EcomdyLogo({
  className,
  size = 40,
  title = "Ecomdy",
}: EcomdyLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width="40" height="40" rx="11" fill="#178BFF" />
      <path
        d="M12.5 13.2h15.2c.66 0 1.2.54 1.2 1.2v1.35c0 .66-.54 1.2-1.2 1.2H16.1v2.55h9.35c.55 0 1 .45 1 1v1.15c0 .55-.45 1-1 1H16.1v2.7h11.6c.66 0 1.2.54 1.2 1.2v1.35c0 .66-.54 1.2-1.2 1.2H12.5c-.66 0-1.2-.54-1.2-1.2V14.4c0-.66.54-1.2 1.2-1.2Z"
        fill="white"
      />
      <path
        d="M28.4 20.15c0-.55.45-1 1-1h1.35c.55 0 1 .45 1 1v9.05c0 .55-.45 1-1 1H29.4c-.55 0-1-.45-1-1v-9.05Z"
        fill="white"
        opacity="0.92"
      />
      <path
        d="M32.5 23.9c0-.55.45-1 1-1H35c.55 0 1 .45 1 1v5.3c0 .55-.45 1-1 1h-1.5c-.55 0-1-.45-1-1v-5.3Z"
        fill="white"
        opacity="0.55"
      />
    </svg>
  );
}

export function EcomdyWordmark({
  className,
  markSize = 40,
  showWord = true,
}: {
  className?: string;
  markSize?: number;
  showWord?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <EcomdyLogo size={markSize} />
      {showWord ? (
        <span className="text-[1.05em] font-semibold tracking-[-0.03em] text-[var(--auth-text,#f8fafc)]">
          Ecomdy
        </span>
      ) : null}
    </div>
  );
}
