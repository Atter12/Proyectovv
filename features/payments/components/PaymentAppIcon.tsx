"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

export type PaymentAppKey =
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
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
} as const;

const SIZE_PX = {
  sm: 32,
  md: 36,
  lg: 40,
} as const;

/** Icono de marca para Yape / Plin / bancos (deeplinks Cobrana). */
export function PaymentAppIcon({
  app,
  size = "md",
  className,
}: PaymentAppIconProps) {
  const usesOfficialAsset = ["yape", "plin", "bcp", "bbva", "interbank"].includes(app);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5",
        SIZE[size],
        iconShell(app),
        className,
      )}
      aria-hidden
    >
      {usesOfficialAsset ? (
        <OfficialPaymentAppImage app={app} diameter={SIZE_PX[size]} />
      ) : (
        <Mark app={app} />
      )}
    </span>
  );
}

function OfficialPaymentAppImage({
  app,
  diameter,
}: {
  app: PaymentAppKey;
  diameter: number;
}) {
  if (app === "yape") {
    const scale = diameter / 138;
    return (
      <Image
        src="/payment-methods/yape-reference.png"
        alt=""
        width={605}
        height={346}
        className="absolute max-w-none"
        style={{
          width: 605 * scale,
          height: 346 * scale,
          left: -38 * scale,
          top: -17 * scale,
        }}
      />
    );
  }

  if (app === "bcp" || app === "interbank") {
    const scale = diameter / 311;
    return (
      <Image
        src="/payment-methods/peru-banks-reference.png"
        alt=""
        width={633}
        height={315}
        className="absolute max-w-none"
        style={{
          width: 633 * scale,
          height: 315 * scale,
          left: app === "bcp" ? 0 : -320 * scale,
          top: 0,
        }}
      />
    );
  }

  return (
    <Image
      src={
        app === "plin"
          ? "/payment-methods/plin-circle.png"
          : "/payment-methods/bbva-circle.png"
      }
      alt=""
      fill
      sizes={`${diameter}px`}
      className="object-cover"
    />
  );
}

function iconShell(app: PaymentAppKey): string {
  switch (app) {
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
    case "yape":
      return <YapeBrandMark />;
    case "plin":
      return <PlinBrandMark />;
    case "bcp":
      return <BcpBrandMark />;
    case "bbva":
      return <BbvaBrandMark />;
    case "interbank":
      return <InterbankBrandMark />;
    case "scotiabank":
      return <ScotiaBrandMark />;
    case "banco":
      return <BankBrandMark light />;
    default:
      return <BankBrandMark />;
  }
}

export function YapeBrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("h-[78%] w-[78%]", className)}
      aria-hidden
    >
      <path
        fill="#fff"
        d="M8.2 26.8c1.15-3.9 2.55-8.55 3.85-12.85.35-1.15.95-1.7 2.05-1.7 1.05 0 1.7.6 1.35 1.85-.95 3.35-2.15 7.2-3.2 10.85-.25.9.1 1.35 1.05 1.35h1.55c.95 0 1.4-.45 1.65-1.3 1.05-3.55 2.25-7.45 3.3-10.95.35-1.15.95-1.8 2.1-1.8 1.1 0 1.7.65 1.35 1.85-1.2 4.15-2.65 9-3.9 13.15-.45 1.5-1.35 2.2-2.95 2.2h-4.7c-1.7 0-2.55-.75-3-2.15-.15-.45-.2-.9-.05-1.4z"
      />
      <path
        fill="#01D0B5"
        d="M27.2 9.1c2.35 0 4.15 1.7 4.15 4.05 0 2.45-1.85 4.25-4.3 4.25-.55 0-1.05-.1-1.5-.25l-1.85.95c-.35.2-.7 0-.7-.4v-1.55c-.55-.55-.9-1.35-.9-2.25 0-2.55 1.85-4.8 5.1-4.8z"
      />
      <text
        x="27.1"
        y="14.35"
        textAnchor="middle"
        fill="#5F0B72"
        fontSize="5.2"
        fontWeight="700"
        fontFamily="system-ui,Segoe UI,sans-serif"
      >
        S/
      </text>
    </svg>
  );
}

function PlinBrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-[72%] w-[72%]" aria-hidden>
      <path
        fill="#fff"
        d="M10 12.2h8.4c3.55 0 5.9 2.1 5.9 5.35 0 3.3-2.35 5.4-5.9 5.4H14.4V28H10V12.2zm4.4 7.05h3.55c1.55 0 2.45-.85 2.45-2.1s-.9-2.05-2.45-2.05H14.4v4.15z"
      />
      <circle cx="28.5" cy="25.5" r="3.2" fill="#fff" opacity="0.95" />
    </svg>
  );
}

function BcpBrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-[70%] w-[70%]" aria-hidden>
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="13"
        fontWeight="800"
        fontFamily="Arial Black,Arial,sans-serif"
        letterSpacing="-0.5"
      >
        BCP
      </text>
    </svg>
  );
}

function BbvaBrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-[72%] w-[72%]" aria-hidden>
      <path fill="#fff" d="M8 28 20 8l12 20H8z" opacity="0.95" />
      <path fill="#072146" d="M14.2 24.2h11.6L20 14.4 14.2 24.2z" opacity="0.35" />
    </svg>
  );
}

function InterbankBrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-[70%] w-[70%]" aria-hidden>
      <path
        fill="#fff"
        d="M11 11h4.2v18H11V11zm7.2 0H28c3.2 0 5.4 2 5.4 5.1 0 3.15-2.2 5.15-5.4 5.15h-5.6V29h-4.2V11zm4.2 6.9h5c1.35 0 2.15-.75 2.15-1.9s-.8-1.85-2.15-1.85h-5v3.75z"
      />
    </svg>
  );
}

function ScotiaBrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-[68%] w-[68%]" aria-hidden>
      <path
        fill="#fff"
        d="M20 8.5c6.2 0 10.8 3.9 10.8 9.4 0 3.55-2.1 6.35-5.55 7.85L28.5 31.5h-4.4l-2.45-4.85c-.5.05-1 .08-1.55.08-6.2 0-10.8-3.9-10.8-9.4S13.8 8.5 20 8.5zm0 4.1c-3.55 0-6.1 2.15-6.1 5.3S16.45 23.2 20 23.2s6.1-2.15 6.1-5.3-2.55-5.3-6.1-5.3z"
      />
    </svg>
  );
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
