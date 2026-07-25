import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";

export function AuthBrandMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <HolisticLogo size={compact ? 36 : 48} />
      <span
        className={cn(
          "font-semibold tracking-[-0.03em] text-[var(--auth-text)]",
          compact ? "text-base" : "text-xl",
        )}
      >
        {siteConfig.name}
      </span>
    </div>
  );
}
