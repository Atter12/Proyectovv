import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import { EcomdyLogo } from "@/components/brand/EcomdyLogo";

export function AuthBrandMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <EcomdyLogo
        size={compact ? 36 : 44}
        className="shadow-[0_8px_22px_rgb(23_139_255_/_0.3)]"
      />
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
