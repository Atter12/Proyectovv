import Link from "next/link";
import { cn } from "@/lib/cn";

export function TechloButton({
  href,
  label,
  variant = "primary",
  className,
}: {
  href: string;
  label: string;
  variant?: "primary" | "white";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "tl-btn text-flip-hover-anim",
        variant === "primary" ? "tl-btn-primary" : "tl-btn-white",
        className,
      )}
    >
      <span className="text-flip-inner" data-content={label}>
        {label}
      </span>
    </Link>
  );
}
