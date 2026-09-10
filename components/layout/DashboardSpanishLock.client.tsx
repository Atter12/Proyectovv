"use client";

import { NextIntlClientProvider } from "next-intl";
import es from "@/messages/es.json";

/**
 * Staff dashboard UI stays Spanish. Only real cliente persona uses the active locale.
 */
export function DashboardSpanishLock({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return children;

  return (
    <NextIntlClientProvider locale="es" messages={es}>
      {children}
    </NextIntlClientProvider>
  );
}
