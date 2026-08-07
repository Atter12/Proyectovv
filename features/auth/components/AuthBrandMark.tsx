import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";

export function AuthBrandMark({
  className,
  compact = false,
  tone = "dark",
}: {
  className?: string;
  compact?: boolean;
  /** dark = auth canvas; light = landing clara */
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      aria-label={siteConfig.name}
    >
      <HolisticLogo
        size={compact ? 120 : 200}
        className={cn(
          "w-auto max-w-full object-contain",
          tone === "dark" ? "brightness-110" : "brightness-100",
          compact ? "h-9" : "h-14 sm:h-16",
        )}
      />
    </div>
  );
}
