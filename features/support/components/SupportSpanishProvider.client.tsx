"use client";

import { NextIntlClientProvider } from "next-intl";
import es from "@/messages/es.json";

/**
 * Support chat/FAQ stays Spanish regardless of the user's UI locale.
 */
export function SupportSpanishProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale="es"
      messages={{
        support: es.support,
        common: { loading: es.common.loading },
        nav: { support: es.nav.support },
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
