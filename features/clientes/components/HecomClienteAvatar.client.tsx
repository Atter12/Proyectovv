"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-20 w-20 text-xl",
} as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "CL";
}

/** Hecom Club public avatar (Supabase storage bucket `avatars`). */
export function HecomClienteAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !failed;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-[var(--brand-primary)]/10 ring-1 ring-[var(--brand-primary)]/15",
        sizeClasses[size],
        className,
      )}
    >
      {showImage ? (
        // Public Hecom Storage URL — plain img avoids next/image remote config friction
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="grid h-full w-full place-items-center font-bold text-[var(--brand-primary)]">
          {initials(name)}
        </span>
      )}
    </div>
  );
}
