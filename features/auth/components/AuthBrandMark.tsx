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
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-[10px] bg-[var(--auth-accent)] font-bold text-white",
          compact ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-[11px]",
        )}
        aria-hidden
      >
        VV
      </div>
      <span
        className={cn(
          "font-semibold tracking-tight text-[var(--auth-text)]",
          compact ? "text-sm" : "text-[15px]",
        )}
      >
        {siteConfig.name}
      </span>
    </div>
  );
}
