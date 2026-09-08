"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

export type PaymentAppKey =
  | "stripe"
  | "visa"
  | "mastercard"
  | "yape"
  | "plin"
  | "bcp"
  | "bbva"
  | "interbank"
  | "scotiabank"
  | "banco"
  | "generic";

const APP_META: Record<
  PaymentAppKey,
  { label: string; bg: string; hover: string; text: string }
> = {
  stripe: {
    label: "Stripe",
    bg: "bg-[#635BFF]",
    hover: "",
    text: "text-white",
  },
  visa: {
    label: "Visa",
    bg: "bg-[#1434CB]",
    hover: "",
    text: "text-white",
  },
  mastercard: {
    label: "Mastercard",
    bg: "bg-white",
    hover: "",
    text: "text-[var(--foreground)]",
  },
  yape: {
    label: "Yape",
    bg: "bg-[#5F0B72] hover:bg-[#4a0959]",
    hover: "",
    text: "text-white",
  },
  plin: {
    label: "Plin",
    bg: "bg-[#00A19C] hover:bg-[#008f8a]",
    hover: "",
    text: "text-white",
  },
  bcp: {
    label: "BCP",
    bg: "bg-[#002A8D] hover:bg-[#002270]",
    hover: "",
    text: "text-white",
  },
  bbva: {
    label: "BBVA",
    bg: "bg-[#072146] hover:bg-[#051830]",
    hover: "",
    text: "text-white",
  },
  interbank: {
    label: "Interbank",
    bg: "bg-[#00A74F] hover:bg-[#008f44]",
    hover: "",
    text: "text-white",
  },
  scotiabank: {
    label: "Scotiabank",
    bg: "bg-[#EC111A] hover:bg-[#c90e16]",
    hover: "",
    text: "text-white",
  },
  banco: {
    label: "Banco",
    bg: "bg-[#1f2937] hover:bg-[#111827]",
    hover: "",
    text: "text-white",
  },
  generic: {
    label: "Pagar",
    bg: "border border-[var(--border-subtle)] bg-white hover:bg-[var(--surface-soft)]",
    hover: "",
    text: "text-[var(--foreground)]",
  },
};

/** Normaliza key/label de Cobrana deeplink → marca conocida. */
export function resolvePaymentAppKey(
  key?: string | null,
  label?: string | null,
): PaymentAppKey {
  const raw = `${key ?? ""} ${label ?? ""}`.toLowerCase().trim();
  if (!raw) return "generic";
  if (raw.includes("stripe")) return "stripe";
  if (raw.includes("visa")) return "visa";
  if (raw.includes("mastercard")) return "mastercard";
  if (raw.includes("yape")) return "yape";
  if (raw.includes("plin")) return "plin";
  if (/\bbcp\b/.test(raw) || raw.includes("credito del peru") || raw.includes("crédito del perú"))
    return "bcp";
  if (raw.includes("bbva") || raw.includes("continental")) return "bbva";
  if (raw.includes("interbank") || raw.includes("ibk")) return "interbank";
  if (raw.includes("scotia")) return "scotiabank";
  if (raw.includes("banco") || raw.includes("bank")) return "banco";
  return "generic";
}

export function paymentAppLabel(
  app: PaymentAppKey,
  fallback?: string | null,
): string {
  if (fallback?.trim()) return fallback.trim();
  return APP_META[app].label;
}

export function paymentAppButtonClass(app: PaymentAppKey): string {
  return cn(APP_META[app].bg, APP_META[app].text);
}

interface PaymentAppIconProps {
  app: PaymentAppKey;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-[3.25rem] w-[3.25rem]",
} as const;

const SIZE_PX = {
  sm: 40,
  md: 48,
  lg: 52,
} as const;

const OFFICIAL_ASSET_PATH: Partial<Record<PaymentAppKey, string>> = {
  stripe: "/payment-methods/stripe-circle.png",
  visa: "/payment-methods/visa-circle.png",
  mastercard: "/payment-methods/mastercard-circle.png",
  yape: "/payment-methods/yape-circle.png",
  plin: "/payment-methods/plin-circle.png",
  bcp: "/payment-methods/bcp-circle.png",
  bbva: "/payment-methods/bbva-circle.png",
  interbank: "/payment-methods/interbank-circle.png",
  scotiabank: "/payment-methods/scotiabank-circle.png",
};

/** Icono de marca para Yape / Plin / bancos (deeplinks Cobrana). */
export function PaymentAppIcon({
  app,
  size = "md",
  className,
}: PaymentAppIconProps) {
  const officialAsset = OFFICIAL_ASSET_PATH[app];
  const preserveOriginalShape = app === "plin";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        preserveOriginalShape
          ? "overflow-visible bg-transparent"
          : "overflow-hidden rounded-full bg-white shadow-[0_0_0_1px_rgb(20_18_16_/_0.08)]",
        SIZE[size],
        !preserveOriginalShape && iconShell(app),
        className,
      )}
      aria-hidden
    >
      {officialAsset ? (
        <Image
          src={officialAsset}
          alt=""
          fill
          sizes={`${SIZE_PX[size]}px`}
          unoptimized
          draggable={false}
          className={preserveOriginalShape ? "object-contain" : "object-cover"}
        />
      ) : (
        <Mark app={app} />
      )}
    </span>
  );
}

function iconShell(app: PaymentAppKey): string {
  switch (app) {
    case "stripe":
      return "bg-[#635BFF]";
    case "visa":
      return "bg-[#1434CB]";
    case "mastercard":
      return "bg-white";
    case "yape":
      return "bg-[#5F0B72]";
    case "plin":
      return "bg-[#00A19C]";
    case "bcp":
      return "bg-[#002A8D]";
    case "bbva":
      return "bg-[#072146]";
    case "interbank":
      return "bg-[#00A74F]";
    case "scotiabank":
      return "bg-[#EC111A]";
    case "banco":
      return "bg-[#1f2937]";
    default:
      return "bg-[#e8e6e3]";
  }
}

function Mark({ app }: { app: PaymentAppKey }) {
  switch (app) {
    case "banco":
      return <BankBrandMark light />;
    default:
      return <BankBrandMark />;
  }
}

function BankBrandMark({ light = false }: { light?: boolean }) {
  const stroke = light ? "#fff" : "#4b5563";
  return (
    <svg viewBox="0 0 24 24" className="h-[56%] w-[56%]" fill="none" aria-hidden>
      <path
        d="M4 10.25 12 4.8l8 5.45"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10.8v6.2h12v-6.2"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 19.2h17" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
