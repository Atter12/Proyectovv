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
  paypal: {
    cdnUrl: "https://cdn.simpleicons.org/paypal/00457C",
    fallback: "P",
    brandColor: "#00457C",
  },
  payoneer: {
    cdnUrl: "https://cdn.simpleicons.org/payoneer/FF4800",
    fallback: "Po",
    brandColor: "#FF4800",
  },
  usdt: {
    cdnUrl: "https://cdn.simpleicons.org/tether/26A17B",
    fallback: "₮",
    brandColor: "#26A17B",
  },
  airwallex: {
    fallback: "A",
    brandColor: "#612FFF",
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
    size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  const showFallback = !config.cdnUrl || imgError;

  if (showFallback) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg font-bold text-white",
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
        "flex items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-[#e5e7eb]",
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
