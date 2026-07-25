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
    <div
      className={cn("flex w-full items-center justify-center", className)}
      aria-label={siteConfig.name}
    >
      <HolisticLogo
        size={compact ? 120 : 200}
        className={cn(
          "w-auto max-w-full object-contain brightness-110",
          compact ? "h-9" : "h-14 sm:h-16",
        )}
      />
    </div>
  );
}
