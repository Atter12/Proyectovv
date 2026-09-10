import type { Metadata } from "next";
import { Caveat, Plus_Jakarta_Sans, Sora } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { DocumentThemeScope } from "@/components/theme/DocumentThemeScope.client";
import { adminThemeInitScript } from "@/lib/admin-theme-script";
import { criticalCss, cssLoadGuardScript } from "@/lib/critical-css";
import { assertProductionSecrets } from "@/lib/env/env.server";
import { clerkConfigured, clerkLoginEnabled, clerkRoutes } from "@/lib/auth/clerk";
import { holisticClerkAppearance } from "@/lib/auth/clerk-appearance";
import { getClerkLocalization } from "@/lib/auth/clerk-localization";
import { resolveAppLocale } from "@/i18n/config";
import { routes } from "@/config/routes";
import "./globals.css";

/** Dashboard / auth UI. */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: true,
});

/** Landing Techlo Lite → Holistic. */
const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
  weight: ["400", "500", "700"],
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: true,
});

/** Acento tipográfico auth (mockup script). */
const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-caveat",
  weight: ["500", "600", "700"],
  fallback: ["cursive"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  assertProductionSecrets();

  const locale = resolveAppLocale(await getLocale());
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkEnabled = clerkConfigured() && clerkLoginEnabled();

  const body = (
    <NextIntlClientProvider>
      <DocumentThemeScope />
      {children}
    </NextIntlClientProvider>
  );

  return (
    <html
      lang={locale}
      className={`${plusJakarta.variable} ${sora.variable} ${caveat.variable} light h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <style
          id="holistic-critical-css"
          dangerouslySetInnerHTML={{ __html: criticalCss }}
        />
        <script dangerouslySetInnerHTML={{ __html: adminThemeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: cssLoadGuardScript }} />
      </head>
      <body
        className={`${plusJakarta.className} min-h-full overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] antialiased`}
      >
        {clerkEnabled && publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            localization={getClerkLocalization(locale)}
            appearance={holisticClerkAppearance}
            signInUrl={clerkRoutes.signIn}
            signUpUrl={clerkRoutes.signUp}
            signInFallbackRedirectUrl={clerkRoutes.complete}
            signUpFallbackRedirectUrl={clerkRoutes.complete}
            afterSignOutUrl={routes.login}
            allowedRedirectOrigins={[
              "https://www.adsholistic.com",
              "https://adsholistic.com",
              "http://localhost:3000",
            ]}
          >
            {body}
          </ClerkProvider>
        ) : (
          body
        )}
      </body>
    </html>
  );
}
