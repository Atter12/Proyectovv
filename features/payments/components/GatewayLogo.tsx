"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import type { PaymentGatewayId } from "@/types/payment";
import { PaymentAppIcon } from "./PaymentAppIcon";

interface GatewayLogoProps {
  gatewayId: PaymentGatewayId;
  size?: "sm" | "md";
}

const SIZE = {
  sm: "h-12 w-12",
  md: "h-[3.25rem] w-[3.25rem]",
} as const;

export function GatewayLogo({ gatewayId, size = "md" }: GatewayLogoProps) {
  if (gatewayId === "stripe") {
    return <PaymentAppIcon app="stripe" size={size === "sm" ? "md" : "lg"} />;
  }

  if (gatewayId === "cobrana") {
    return <PaymentAppIcon app="yape" size={size === "sm" ? "md" : "lg"} />;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden shadow-[inset_0_0_0_1px_rgb(20_18_16_/_0.06)]",
        gatewayId === "crypto" || gatewayId === "manual"
          ? "rounded-full"
          : "rounded-xl",
        SIZE[size],
        shellClass(gatewayId),
      )}
      aria-hidden
    >
      <GatewayMark id={gatewayId} />
    </div>
  );
}

function shellClass(id: PaymentGatewayId) {
  switch (id) {
    case "culqi":
      return "bg-[#00A19A]";
    case "mercadopago":
      return "bg-[#009EE3]";
    case "crypto":
      return "bg-black";
    case "manual":
      return "bg-[#1f1c19]";
    default:
      return "bg-white";
  }
}

function GatewayMark({ id }: { id: PaymentGatewayId }) {
  switch (id) {
    case "stripe":
      return null;
    case "culqi":
      return <CulqiMark />;
    case "mercadopago":
      return <MercadoPagoMark />;
    case "crypto":
      return <BinanceMark />;
    case "manual":
      return <ManualMark />;
    case "cobrana":
      return null;
  }
}

/** Culqi — open C + accent (brand teal tile) */
function CulqiMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" aria-hidden>
      <path
        d="M17.4 7.05A7.2 7.2 0 1 0 17.5 17l-2.05-1.55a4.55 4.55 0 1 1-.05-6.85L17.4 7.05Z"
        fill="#fff"
      />
      <path
        d="M14.2 12a2.2 2.2 0 1 1 4.4 0 2.2 2.2 0 0 1-4.4 0Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Mercado Pago — dual handshake hearts */
function MercadoPagoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" aria-hidden>
      <path
        fill="#fff"
        d="M10.2 4.6c-1.45 0-2.7.7-3.4 1.75C6.1 5.3 4.85 4.6 3.4 4.6 1.7 4.6.4 6 .4 7.85c0 3.85 4.1 7.15 7.95 9.9l.85.6.85-.6c3.85-2.75 7.95-6.05 7.95-9.9 0-1.85-1.3-3.25-3-3.25-1.45 0-2.7.7-3.4 1.75-.7-1.05-1.95-1.75-3.4-1.75z"
      />
      <path
        fill="#fff"
        opacity="0.5"
        d="M18.35 9.15c-1.05 0-1.95.5-2.5 1.25-.55-.75-1.45-1.25-2.5-1.25-1.65 0-3 1.35-3 3 0 2.55 2.7 4.7 5.15 6.5l.7.5.7-.5c2.45-1.8 5.15-3.95 5.15-6.5 0-1.65-1.35-3-3-3z"
      />
    </svg>
  );
}

/** Binance brand asset for crypto recharges. */
function BinanceMark() {
  return (
    <Image
      src="/payment-methods/binance.png"
      alt=""
      width={52}
      height={52}
      unoptimized
      draggable={false}
      className="h-full w-full object-contain"
    />
  );
}

/** Bank facade with a pediment, columns, and steps for manual transfers. */
function ManualMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="#fff" aria-hidden>
      <path d="M12 2 2 7.5V9h20V7.5L12 2Z" />
      <rect x="4" y="11" width="3" height="6" rx="0.5" />
      <rect x="10.5" y="11" width="3" height="6" rx="0.5" />
      <rect x="17" y="11" width="3" height="6" rx="0.5" />
      <rect x="3" y="18" width="18" height="2" rx="0.5" />
      <rect x="1" y="21" width="22" height="2" rx="0.5" />
    </svg>
  );
}
