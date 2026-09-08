"use client";

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
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_rgb(20_18_16_/_0.06)]",
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
      return "bg-[#26A17B]";
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
      return <UsdtMark />;
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

/** USDT / Tether T */
function UsdtMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" aria-hidden>
      <path
        d="M5 7.1h14v2.05H13.1v8.75h-2.2V9.15H5V7.1Z"
        fill="#fff"
      />
      <path
        d="M4.2 5.4h15.6v1.35H4.2V5.4Z"
        fill="#fff"
      />
      <path
        d="M7.4 12.35c0-.55 2.05-1 4.6-1s4.6.45 4.6 1-2.05 1-4.6 1-4.6-.45-4.6-1Z"
        fill="#fff"
        opacity="0.45"
      />
    </svg>
  );
}

/** Bank transfer — manual review */
function ManualMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[56%] w-[56%]" fill="none" aria-hidden>
      <path
        d="M4 10.25 12 4.8l8 5.45"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10.8v6.2h12v-6.2"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 19.2h17"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8.5 13.2v2.2M12 13.2v2.2M15.5 13.2v2.2"
        stroke="#fff"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}
