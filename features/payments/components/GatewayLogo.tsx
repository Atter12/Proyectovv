"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { PaymentGatewayId } from "@/types/payment";

interface GatewayLogoConfig {
  cdnUrl?: string;
  fallback: string;
  brandColor: string;
}

const GATEWAY_LOGOS: Record<PaymentGatewayId, GatewayLogoConfig> = {
  stripe: {
    cdnUrl: "https://cdn.simpleicons.org/stripe/635BFF",
    fallback: "S",
    brandColor: "#635BFF",
  },
  culqi: {
    fallback: "C",
    brandColor: "#00A19A",
  },
  mercadopago: {
    cdnUrl: "https://cdn.simpleicons.org/mercadopago/00B1EA",
    fallback: "MP",
    brandColor: "#00B1EA",
  },
  crypto: {
    fallback: "₮",
    brandColor: "#26A17B",
  },
  manual: {
    fallback: "M",
    brandColor: "#6b645c",
  },
};

interface GatewayLogoProps {
  gatewayId: PaymentGatewayId;
  size?: "sm" | "md";
}

export function GatewayLogo({ gatewayId, size = "md" }: GatewayLogoProps) {
  const config = GATEWAY_LOGOS[gatewayId];
  const [imgError, setImgError] = useState(false);

  const boxClass =
    size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-[12px]";

  const showFallback = !config.cdnUrl || imgError;

  if (showFallback) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md text-[11px] font-medium text-white",
          boxClass,
        )}
        style={{ backgroundColor: config.brandColor }}
        aria-hidden
      >
        {config.fallback}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-[rgb(20_18_16_/_0.08)]",
        boxClass,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.cdnUrl}
        alt={`Logo ${gatewayId}`}
        className="h-5 w-5 object-contain"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
