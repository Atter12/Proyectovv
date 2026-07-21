import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

export function AuthBrandMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-[12px] bg-[var(--auth-accent)] font-bold text-white shadow-[0_8px_20px_rgb(23_139_255_/_0.28)]",
          compact ? "h-9 w-9 text-[11px]" : "h-11 w-11 text-[13px]",
        )}
        aria-hidden
      >
        VV
      </div>
      <span
        className={cn(
          "font-semibold tracking-tight text-[var(--auth-text)]",
          compact ? "text-base" : "text-lg",
        )}
      >
        {siteConfig.name}
      </span>
    </div>
  );
}
