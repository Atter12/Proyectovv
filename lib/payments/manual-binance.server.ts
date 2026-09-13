import "server-only";
import { serverEnv } from "@/lib/env/env.server";

export type ManualBinancePayee = {
  id: string;
  label: string;
  email: string;
  networkHint: string;
  notes: string;
};

const DEFAULT_BINANCE_EMAIL = "master7victor@gmail.com";

function sanitizeEmail(value: string): string {
  return value.replace(/\uFFFD/g, "").trim().toLowerCase();
}

/** Destino Binance Pay / envío a correo (pago manual). */
export function getPublicManualBinancePayee(): ManualBinancePayee | null {
  const fromEnv = sanitizeEmail(serverEnv.manualPaymentBinanceEmail ?? "");
  const email = fromEnv || DEFAULT_BINANCE_EMAIL;
  if (!email.includes("@")) return null;

  return {
    id: "binance-pay",
    label: "Binance Pay",
    email,
    networkHint: "Correo Binance",
    notes:
      "En Binance usa Pay / enviar a correo. Conserva el comprobante para el siguiente paso.",
  };
}
